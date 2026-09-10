#!/usr/bin/env node
// Local preview shell + transparent streaming transport. No agent/session APIs of our own.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { randomBytes } = require('node:crypto');
const { createTerminalBackend } = require('./terminal-backend.cjs');

const origins = port => ['127.0.0.1', 'localhost'].map(host => new URL(`http://${host}:${port}`).origin);
const hosts = port => [...origins(port).map(origin => new URL(origin).host), `127.0.0.1:${port}`, `localhost:${port}`];
const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'];

function cleanHeaders(original) {
  const headers = { ...original };
  for (const name of [...hopHeaders, ...(original.connection || '').toLowerCase().split(',')]) {
    delete headers[name.trim()];
  }
  return headers;
}

function framePolicy(headers, previewPort, terminalHost = 'localhost') {
  const result = cleanHeaders(headers);
  delete result['x-frame-options'];
  const policy = String(result['content-security-policy'] || `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://${terminalHost}; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'`)
    .split(';').filter(rule => !/^\s*frame-ancestors\b/i.test(rule)).join(';');
  result['content-security-policy'] = `${policy}; frame-ancestors ${origins(previewPort).join(' ')}`;
  result['cache-control'] = 'no-store';
  result['referrer-policy'] = 'no-referrer';
  return result;
}

function allowedRequest(req, port, terminal = false) {
  if (!hosts(port).includes(req.headers.host)) return false;
  if (!req.url?.startsWith('/') || req.url.startsWith('//')) return false;
  const origin = req.headers.origin;
  if (origin && !origins(port).includes(origin)) return false;
  // Mutations must originate in the terminal document, not the slides.
  if (terminal && !['GET', 'HEAD'].includes(req.method) && !origin) return false;
  return true;
}

function unavailable(res) {
  res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>终端暂不可用</title>' +
    '<body><h2>终端暂不可用</h2><p>需要本机安装 <code>ttyd</code>、<code>zellij</code> 和 <code>fish</code>。' +
    '安装缺少的工具后重启 <code>make serve</code>。</p><p>无需启动 Zellij Web 服务或创建登录令牌。' +
    '如果工具已齐全，请重启预览；已有会话不会被结束。</p></body></html>');
}

function targetOptions(target) {
  return typeof target === 'number' ? { hostname: '127.0.0.1', port: target } : { socketPath: target };
}
function upstreamHeaders(req, target, terminal) {
  const headers = cleanHeaders(req.headers);
  delete headers.cookie;
  delete headers.authorization;
  delete headers['x-slides-user'];
  if (terminal) headers['x-slides-user'] = 'local';
  else headers.host = `127.0.0.1:${target}`;
  return headers;
}
function proxyHTTP(req, res, target, { terminal = false, previewPort, requestPath = req.url } = {}) {
  const headers = upstreamHeaders(req, target, terminal);
  const upstream = http.request({ ...targetOptions(target),
    method: req.method, path: requestPath, headers }, incoming => {
    const outgoing = terminal ? framePolicy(incoming.headers, previewPort, req.headers.host) : cleanHeaders(incoming.headers);
    if (!terminal) delete outgoing['set-cookie'];
    res.writeHead(incoming.statusCode, outgoing);
    incoming.pipe(res);
    incoming.on('error', () => res.destroy());
  });
  upstream.setTimeout(120000, () => upstream.destroy());
  upstream.on('error', () => {
    if (res.headersSent) return res.destroy();
    if (terminal) unavailable(res);
    else { res.writeHead(502); res.end('Marp is starting or unavailable. Reload shortly.'); }
  });
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}

function socketReply(socket, status, headers = {}) {
  socket.write(`HTTP/1.1 ${status}\r\n` + Object.entries(headers)
    .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map(item => `${key}: ${item}\r\n`)).join('') + '\r\n');
}

function proxyUpgrade(req, socket, head, target, sockets, terminal) {
  const headers = { ...upstreamHeaders(req, target, terminal), connection: 'Upgrade', upgrade: 'websocket' };
  const upstream = http.request({ ...targetOptions(target), path: req.url, headers, agent: false });
  let upgraded = false;
  upstream.setTimeout(10000, () => upstream.destroy());
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
  upstream.on('upgrade', (response, peer, upstreamHead) => {
    upgraded = true;
    peer.setTimeout(0);
    sockets.add(peer);
    peer.on('close', () => { sockets.delete(peer); socket.destroy(); });
    peer.on('error', () => socket.destroy());
    socket.on('close', () => peer.destroy());
    socketReply(socket, '101 Switching Protocols', response.headers);
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) peer.write(head);
    // Node streams propagate TCP backpressure in both directions; never buffer/reparse terminal data.
    socket.pipe(peer).pipe(socket);
  });
  upstream.on('response', response => {
    socketReply(socket, `${response.statusCode} ${response.statusMessage}`, { connection: 'close' });
    response.resume();
    socket.end();
  });
  upstream.on('error', () => {
    if (upgraded) return socket.destroy();
    if (!socket.destroyed) { socketReply(socket, '502 Bad Gateway', { connection: 'close' }); socket.end(); }
  });
  upstream.end();
}

async function startPreview({ port, marpPort, session = '', entry, cwd = process.cwd(),
  backend = createTerminalBackend({ cwd, session }) }) {
  const capability = randomBytes(32).toString('hex');
  const connectPath = `/__connect/${capability}`;
  const sockets = new Set();
  const servers = [];
  const files = new Map(['preview.html', 'preview-drawer.mjs', 'preview-drawer.css']
    .map(name => [name, fs.readFileSync(path.join(__dirname, name))]));
  function makeServer(handler, upgrade) {
    const server = http.createServer(handler);
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    server.on('upgrade', upgrade);
    servers.push(server);
    return server;
  }
  const listen = (server, listenPort) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(listenPort, '127.0.0.1', resolve);
  });
  const reject = res => { res.writeHead(403); res.end('Local preview origin required'); };
  const rejectSocket = socket => { socketReply(socket, '403 Forbidden', { connection: 'close' }); socket.end(); };
  let closing;
  const close = () => {
    if (!closing) {
      for (const socket of sockets) socket.destroy();
      for (const server of servers) server.close();
      closing = Promise.resolve(backend.close());
    }
    return closing;
  };
  let terminalPort, target;
  const cookie = () => `slides_terminal_${terminalPort}=${capability}`;
  const authorized = req => String(req.headers.cookie || '').split(';').some(value => value.trim() === cookie());
  const terminal = makeServer(async (req, res) => {
    if (!allowedRequest(req, terminalPort, true)) return reject(res);
    if (req.method === 'GET' && req.url === connectPath) {
      try { target = await backend.start(); } catch { return unavailable(res); }
      if (res.destroyed) return;
      res.writeHead(303, { location: '/', 'set-cookie': `${cookie()}; HttpOnly; SameSite=Strict; Path=/`,
        'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
      return res.end();
    }
    if (!authorized(req) || !target) return reject(res);
    proxyHTTP(req, res, target, { terminal: true, previewPort: port });
  }, (req, socket, head) => {
    if (!allowedRequest(req, terminalPort, true) || !origins(terminalPort).includes(req.headers.origin) ||
        !authorized(req) || !target || req.url !== '/ws') return rejectSocket(socket);
    proxyUpgrade(req, socket, head, target, sockets, true);
  });
  try {
    await listen(terminal, 0);
    terminalPort = terminal.address().port;
    const preview = makeServer((req, res) => {
      if (!allowedRequest(req, port)) return reject(res);
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
      if (url.pathname === '/') {
        res.writeHead(302, { location: `/${entry}${url.search}` }); return res.end();
      }
      if (url.pathname === `/${entry}` && !['pdf', 'png', 'jpg', 'jpeg', 'pptx', 'notes', 'txt'].some(key => url.searchParams.has(key))) {
        const hostname = req.headers.host.split(':')[0];
        const terminalOrigin = `http://${hostname}:${terminalPort}`;
        const config = JSON.stringify({ entry, terminalOrigin, terminalURL: terminalOrigin + connectPath,
          session: backend.session }).replace(/</g, '\\u003c');
        const body = files.get('preview.html').toString().replace('<!--PREVIEW_CONFIG-->', config);
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
          'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
          'content-security-policy': `default-src 'self'; script-src 'self'; style-src 'self'; frame-src 'self' ${terminalOrigin}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` });
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      if (url.pathname.startsWith('/__preview__/')) {
        const name = url.pathname.slice('/__preview__/'.length);
        if (!['preview-drawer.mjs', 'preview-drawer.css'].includes(name)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/javascript',
          'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
        return res.end(req.method === 'HEAD' ? undefined : files.get(name));
      }
      const requestPath = req.url.startsWith('/__slides__/') ? req.url.slice('/__slides__'.length) : req.url;
      proxyHTTP(req, res, marpPort, { requestPath });
    }, (req, socket, head) => {
      if (!allowedRequest(req, port) || !origins(port).includes(req.headers.origin) ||
          !req.url.startsWith('/.__marp-cli-watch-notifier__/')) return rejectSocket(socket);
      proxyUpgrade(req, socket, head, marpPort, sockets, false);
    });
    await listen(preview, port);
    return { close, terminalPort };
  } catch (error) { await close(); throw error; }
}

module.exports = { startPreview, cleanHeaders, framePolicy, allowedRequest };
if (require.main === module) {
  const { values } = parseArgs({ options: Object.fromEntries(
    ['port', 'marp-port', 'session', 'entry', 'cwd'].map(name => [name, { type: 'string' }])) });
  const port = Number(values.port), marpPort = Number(values['marp-port']);
  if (![port, marpPort].every(value => Number.isInteger(value) && value > 0 && value <= 65535) ||
      port === marpPort || !values.cwd || !['slides.md', 'example.md'].includes(values.entry)) {
    console.error('Invalid preview ports or entry'); process.exit(2);
  }
  startPreview({ port, marpPort, session: values.session || '', cwd: values.cwd, entry: values.entry }).then(({ close }) => {
    console.log(`Preview: http://localhost:${port}/${values.entry}`);
    console.log('Click Open terminal for fish. No Web service/login setup; sessions survive closing preview.');
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { close().then(() => process.exit(0)); });
  }).catch(() => { console.error('Cannot start local preview (check PORT).'); process.exitCode = 2; });
}
