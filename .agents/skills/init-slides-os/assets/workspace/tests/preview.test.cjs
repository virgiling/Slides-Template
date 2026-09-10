const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const postcss = require('postcss');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const { startPreview, framePolicy, allowedRequest } = require('../scripts/preview-proxy.cjs');
const { sessionName, createTerminalBackend } = require('../scripts/terminal-backend.cjs');
// Reuse the pinned Marp runtime's WebSocket dependency for protocol-only tests.
const { WebSocket, WebSocketServer } = createRequire(require.resolve('@marp-team/marp-cli/package.json'))('ws');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}
async function freePort() {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}
function request(port, pathname = '/', options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, ...options }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end(options.body);
  });
}

// DOM/API contract fixture, not a browser renderer. Capture listeners run before
// the already-installed native Marp handlers; fullscreen requires a live gesture.
function fullscreenFixture(webkit = false) {
  function events() {
    const listeners = [];
    return { listeners,
      addEventListener(type, fn, capture = false) { listeners.push({ type, fn, capture }); },
      removeEventListener(type, fn, capture = false) {
        const index = listeners.findIndex(item => item.type === type && item.fn === fn && item.capture === capture);
        if (index >= 0) listeners.splice(index, 1);
      },
      emit(type, properties = {}) {
        const event = { ...properties, defaultPrevented: false, stopped: false,
          preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
        const ordered = listeners.filter(item => item.type === type).sort((a, b) => Number(b.capture) - Number(a.capture));
        for (const { fn } of ordered) { if (event.stopped) break; fn(event); }
        return event;
      } };
  }
  const document = events(), slideDocument = events(), calls = [];
  const root = {}, body = { tagName: 'BODY' }, classes = new Set(), attributes = {};
  const button = { tagName: 'BUTTON', blur() {}, closest(selector) {
    return selector === '[data-bespoke-marp-osc="fullscreen"]' ? this : null;
  }, classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } },
  setAttribute(name, value) { attributes[name] = value; } };
  const element = webkit ? 'webkitFullscreenElement' : 'fullscreenElement';
  const change = webkit ? 'webkitfullscreenchange' : 'fullscreenchange';
  let gesture = false;
  document.documentElement = root;
  document[webkit ? 'webkitFullscreenEnabled' : 'fullscreenEnabled'] = true;
  const setActive = value => { document[element] = value; document.emit(change); };
  root[webkit ? 'webkitRequestFullscreen' : 'requestFullscreen'] = function () {
    assert.equal(this, root); assert.ok(gesture, 'request must not defer past the user gesture');
    calls.push('enter'); setActive(root); return webkit ? undefined : Promise.resolve();
  };
  document[webkit ? 'webkitExitFullscreen' : 'exitFullscreen'] = function () {
    assert.equal(this, document); calls.push('exit'); setActive(null); return webkit ? undefined : Promise.resolve();
  };
  // Marp 4.5.1 targets the inner document.body; these handlers must not also run.
  body.requestFullscreen = () => calls.push('inner');
  slideDocument.addEventListener('click', event => { if (event.target?.closest?.('[data-bespoke-marp-osc="fullscreen"]')) body.requestFullscreen(); });
  slideDocument.addEventListener('keydown', event => {
    if (['f', 'F11'].includes(event.key) && !event.altKey && !event.ctrlKey && !event.metaKey) body.requestFullscreen();
  });
  slideDocument.querySelectorAll = selector => selector === '[data-bespoke-marp-osc="fullscreen"]' ? [button] : [];
  const send = (type, properties = {}) => {
    gesture = true;
    try { return slideDocument.emit(type, { target: body, ...properties }); } finally { gesture = false; }
  };
  return { document, slideDocument, root, body, button, classes, attributes, calls, send, setActive };
}

test('preview routes native fullscreen gestures to the entire shell and tracks Escape in standard/WebKit APIs', async () => {
  const { installSlideFullscreen } = await import('../scripts/preview-drawer.mjs');
  for (const webkit of [false, true]) {
    const model = fullscreenFixture(webkit);
    const nativeRequest = model.body.requestFullscreen;
    const release = installSlideFullscreen(model.document, model.slideDocument);
    const nestedIcon = { closest: selector => model.button.closest(selector) };
    assert.equal(model.send('click', { target: nestedIcon }).defaultPrevented, true);
    assert.deepEqual(model.calls, ['enter']);
    assert.equal(model.classes.has('exit'), true);
    assert.equal(model.attributes['aria-pressed'], 'true');
    model.send('keydown', { key: 'f' });
    assert.deepEqual(model.calls, ['enter', 'exit']);
    assert.equal(model.classes.has('exit'), false);
    model.send('keydown', { key: 'F11' });
    assert.deepEqual(model.calls, ['enter', 'exit', 'enter']);
    model.setActive(null); // Browser Escape exits without going through our handlers.
    assert.equal(model.classes.has('exit'), false);
    assert.equal(model.attributes['aria-pressed'], 'false');
    assert.equal(model.body.requestFullscreen, nativeRequest, 'do not monkey-patch the browser API');
    release();
    assert.equal(model.document.listeners.length, 0);
    assert.equal(model.slideDocument.listeners.length, 2, 'cleanup retains only the native listeners');
  }
});

test('fullscreen ignores typing, composition and other shortcuts, and handles unavailable/denied APIs', async t => {
  const { installSlideFullscreen } = await import('../scripts/preview-drawer.mjs');
  const model = fullscreenFixture();
  const release = installSlideFullscreen(model.document, model.slideDocument);
  for (const properties of [{ key: 'j' }, { key: 'f', ctrlKey: true }, { key: 'f', metaKey: true },
    { key: 'F11', altKey: true }, { key: 'f', isComposing: true }, { key: 'f', keyCode: 229 },
    { key: 'f', target: { tagName: 'INPUT' } }, { key: 'f', target: { isContentEditable: true } }]) {
    assert.equal(model.send('keydown', properties).defaultPrevented, false, 'typing must keep its default action');
  }
  assert.deepEqual(model.calls, []);
  release();
  model.document.fullscreenEnabled = false;
  installSlideFullscreen(model.document, model.slideDocument)();
  assert.equal(model.slideDocument.listeners.length, 2);
  model.document.fullscreenEnabled = true;
  model.root.requestFullscreen = () => Promise.reject(new Error('synthetic fullscreen denial'));
  const warning = t.mock.method(console, 'warn', () => {});
  const cleanup = installSlideFullscreen(model.document, model.slideDocument);
  model.send('keydown', { key: 'f' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warning.mock.callCount(), 1, 'consume API rejection, not an unhandled promise');
  assert.equal(model.classes.has('exit'), false);
  cleanup();
});

test('frame adaptation preserves CSP and cookies; request origins stay local', () => {
  const headers = framePolicy({ 'x-frame-options': 'DENY',
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'; font-src 'self'", 'set-cookie': ['synthetic=1; HttpOnly'] }, 8080);
  assert.equal(headers['x-frame-options'], undefined);
  assert.ok(headers['content-security-policy'].includes("font-src 'self'"));
  assert.ok(headers['content-security-policy'].includes('frame-ancestors http://127.0.0.1:8080 http://localhost:8080'));
  assert.equal((headers['content-security-policy'].match(/frame-ancestors/g) || []).length, 1);
  assert.deepEqual(headers['set-cookie'], ['synthetic=1; HttpOnly']);
  assert.equal(allowedRequest({ method: 'GET', url: '/', headers: { host: 'localhost', origin: 'http://localhost' } }, 80), true);
  const req = { method: 'POST', url: '/command/login', headers: { host: '127.0.0.1:8083' } };
  assert.equal(allowedRequest(req, 8083, true), false);
  req.headers.origin = 'http://127.0.0.1:8083';
  assert.equal(allowedRequest(req, 8083, true), true);
  req.headers.origin = 'http://127.0.0.1:8080';
  assert.equal(allowedRequest(req, 8083, true), false, 'slide scripts cannot issue terminal mutations');
  req.headers.origin = 'https://untrusted.example';
  assert.equal(allowedRequest(req, 8083, true), false);
  req.headers.host = 'attacker.example:8083';
  assert.equal(allowedRequest(req, 8083, true), false);
});

test('floating controls and translucent drawer overlay a full-size player at desktop and mobile widths', () => {
  const html = fs.readFileSync(require.resolve('../scripts/preview.html'), 'utf8');
  assert.match(html, /<body>\s*<button id="terminal-toggle"/);
  assert.ok(!html.includes('preview-toolbar'), 'no full-width top toolbar');
  const panelMarkup = html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/)[1];
  assert.equal((panelMarkup.match(/<button\b/g) || []).length, 1, 'only the edge collapse button remains');
  assert.doesNotMatch(panelMarkup, /<(?:header|details|input|a)\b/);
  assert.match(panelMarkup, /id="terminal-close"[^>]*aria-label="收起终端抽屉"/);
  assert.match(panelMarkup, /aria-hidden="true">&gt;<\/span>/);
  for (const id of ['terminal-width', 'terminal-reconnect', 'terminal-external', 'terminal-info']) assert.ok(!html.includes(id));
  const css = postcss.parse(fs.readFileSync(require.resolve('../scripts/preview-drawer.css'), 'utf8'));
  function declarations(selectors, width) {
    const result = {};
    css.walkRules(rule => {
      if (!rule.selector.split(',').some(selector => selectors.includes(selector.trim()))) return;
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type !== 'atrule' || parent.name !== 'media') continue;
        if (parent.params === 'print') return;
        const maxWidth = parent.params.match(/^\(max-width: (\d+)px\)$/);
        assert.ok(maxWidth, `unhandled test media query: ${parent.params}`);
        if (width > Number(maxWidth[1])) return;
      }
      rule.walkDecls(decl => { result[decl.prop] = decl.value; });
    });
    return result;
  }
  for (const width of [1280, 360]) {
    const player = declarations(['#preview-workspace'], width);
    assert.equal(player.position, 'fixed');
    assert.equal(player.inset, '0');
    for (const property of ['grid-template-columns', 'width', 'padding', 'margin']) assert.equal(player[property], undefined);
    const frame = declarations(['iframe', '#slide-frame'], width);
    assert.equal(frame.width, '100%'); assert.equal(frame.height, '100%');
    const button = declarations(['#terminal-toggle'], width);
    const panel = declarations(['#terminal-panel'], width);
    assert.equal(button.position, 'fixed');
    assert.ok(button.top && button.right);
    assert.equal(panel.position, 'fixed', 'drawer must stay out of player layout flow');
    for (const edge of ['top', 'right', 'bottom']) assert.equal(panel[edge], '0', 'panel fills the entire side');
    assert.match(panel['backdrop-filter'], /blur\(16px\)/);
    assert.equal(panel['border-radius'], '24px');
    assert.equal(panel.overflow, 'visible', 'do not clip the edge button');
    assert.equal(panel['-webkit-backdrop-filter'], panel['backdrop-filter']);
    assert.equal(panel.filter, undefined, 'never blur terminal text');
    assert.ok(Number(button['z-index']) > Number(panel['z-index']));
    assert.ok(Number(panel['z-index']) > 0);
    assert.equal(panel.background, 'rgb(232 232 232 / 88%)', 'neutral off-white glass, darker than pure white');
    assert.equal(panel.opacity, undefined, 'paint translucent background without fading text');
    const surface = declarations(['#terminal-container'], width);
    assert.equal(surface.position, 'absolute'); assert.equal(surface.inset, '0', 'no space reserved for a toolbar');
    assert.equal(surface['border-radius'], 'inherit'); assert.equal(surface.overflow, 'hidden');
    assert.equal(surface.padding, '12px', 'keep terminal cells away from the rounded clipping edge');
    assert.equal(surface.background, 'transparent', 'padding must not add a second opaque backing');
    assert.equal(surface.opacity, undefined, 'the native terminal now provides alpha; glyphs stay opaque');
    assert.equal(surface.filter, undefined, 'text stays sharp over the blurred backdrop');
    const terminal = declarations(['iframe', '#terminal-container iframe'], width);
    assert.equal(terminal.opacity, undefined, 'do not fade terminal text');
    assert.equal(terminal.background, 'transparent');
    assert.equal(terminal['color-scheme'], 'light');
    const close = declarations(['#terminal-close'], width);
    assert.equal(close.position, 'absolute'); assert.equal(close.left, '-32px');
    assert.equal(close.top, '50%'); assert.equal(close.width, '32px');
    assert.equal(close.background, panel.background);
    assert.equal(close.color, '#3f3326');
    assert.equal(button.background, panel.background);
    assert.equal(button.color, close.color);
    assert.equal(panel['max-width'], 'calc(100% - 32px)', 'keep the handle visible even on narrow screens');
  }
});

test('drawer mounts lazily, retains connection on repeated open and disconnects without an agent API', async () => {
  const { drawerController } = await import('../scripts/preview-drawer.mjs');
  const calls = [];
  const drawer = drawerController({ mount: () => calls.push(['mount']), unmount: () => calls.push(['unmount']),
    visibility: state => calls.push(['visible', state]), focusSlides: () => calls.push(['focus']) });
  assert.equal(drawer.opened, false);
  assert.equal(calls.length, 0);
  assert.equal(sessionName('/synthetic', '研究 slides'), '研究 slides');
  assert.equal(sessionName('/synthetic'), sessionName('/synthetic'));
  assert.notEqual(sessionName('/synthetic'), sessionName('/other'));
  for (const value of ['..', '.', '-option', 'one/two', 'one\\two', '\u0000']) assert.throws(() => sessionName('/synthetic', value));
  drawer.close();
  assert.equal(calls.length, 0, 'closing an already closed drawer does nothing');
  drawer.open(); drawer.open();
  assert.equal(calls.filter(([name]) => name === 'mount').length, 1);
  drawer.close(); assert.equal(drawer.opened, false);
  assert.deepEqual(calls.slice(-3), [['unmount'], ['visible', false], ['focus']]);
  drawer.close();
  assert.equal(calls.filter(([name]) => name === 'unmount').length, 1, 'do not unmount twice');
  drawer.open();
  assert.equal(calls.filter(([name]) => name === 'mount').length, 2, 'reopening reconnects without a separate toolbar control');
});

test('preview shell keeps terminal mounted across slide hashes and native slide reloads', async () => {
  const { installPreview } = await import('../scripts/preview-drawer.mjs');
  function element() {
    return { events: {}, children: [],
      style: { properties: {}, setProperty(key, value) { this.properties[key] = value; } },
      classList: { toggle() { assert.fail('drawer state must not switch the player layout'); } },
      addEventListener(name, callback) { this.events[name] = callback; },
      setAttribute() {},
      append(child) { this.children.push(child); }, replaceChildren() { this.children = []; } };
  }
  const ids = ['preview-config', 'slide-frame', 'terminal-panel', 'terminal-toggle',
    'terminal-container', 'preview-workspace', 'terminal-close'];
  const nodes = Object.fromEntries(ids.map(id => [id, element()]));
  const terminalURL = 'http://localhost:8083/__connect/synthetic';
  nodes['preview-config'].textContent = JSON.stringify({ entry: 'slides.md', terminalURL, session: 'slides' });
  const child = { ...element(), location: { hash: '#2' }, focus() {} };
  const fullscreen = fullscreenFixture();
  nodes['slide-frame'].contentDocument = fullscreen.slideDocument;
  nodes['slide-frame'].contentWindow = child;
  const window = { ...element(), location: { pathname: '/slides.md', search: '', hash: '#2' },
    history: { replaceState(_state, _title, url) { window.location.hash = new URL(url, 'http://localhost:8080').hash; } } };
  const document = Object.assign(fullscreen.document, {
    getElementById: id => { assert.ok(nodes[id], `unexpected UI element: ${id}`); return nodes[id]; }, createElement: element });
  installPreview(document, window);
  assert.equal(nodes['slide-frame'].src, '/__slides__/slides.md#2');
  assert.equal(nodes['terminal-container'].children.length, 0);
  nodes['terminal-toggle'].events.click();
  const terminal = nodes['terminal-container'].children[0];
  assert.equal(terminal.src, terminalURL);
  assert.equal(nodes['terminal-toggle'].hidden, true, 'hide floating button when drawer is open');
  nodes['slide-frame'].events.load();
  fullscreen.send('keydown', { key: 'f' });
  assert.deepEqual(fullscreen.calls, ['enter']);
  assert.equal(nodes['terminal-container'].children[0], terminal, 'fullscreen must not remount the terminal');
  child.location.hash = '#3'; child.events.hashchange();
  assert.equal(window.location.hash, '#3');
  const replacement = fullscreenFixture().slideDocument;
  nodes['slide-frame'].contentDocument = replacement;
  nodes['slide-frame'].events.load();
  assert.equal(fullscreen.slideDocument.listeners.length, 2, 'remove bridge from the old slide document');
  assert.equal(fullscreen.document.listeners.length, 2, 'do not accumulate parent fullscreen listeners on reload');
  const fullscreenButton = replacement.querySelectorAll('[data-bespoke-marp-osc="fullscreen"]')[0];
  replacement.emit('click', { target: fullscreenButton });
  assert.deepEqual(fullscreen.calls, ['enter', 'exit'], 'new slide document can exit the existing outer fullscreen');
  assert.equal(nodes['terminal-container'].children[0], terminal, 'slide reload must not reload ttyd');
  assert.deepEqual(nodes['preview-workspace'].style.properties, {}, 'opening the drawer leaves the player viewport alone');
  assert.deepEqual(nodes['slide-frame'].style.properties, {});
  window.location.hash = '#4'; window.events.hashchange();
  assert.equal(child.location.hash, '#4');
  assert.equal(window.events.keydown, undefined, 'do not intercept harness keyboard shortcuts');
  nodes['terminal-close'].events.click();
  assert.equal(nodes['terminal-container'].children.length, 0);
  assert.equal(nodes['terminal-toggle'].hidden, false);
  assert.equal(nodes['terminal-panel'].hidden, true);
  nodes['terminal-toggle'].events.click();
  assert.equal(nodes['terminal-container'].children.length, 1);
  assert.equal(nodes['terminal-container'].children[0].src, terminalURL, 'collapse/reopen reconnects the same session');
});

test('Marp preload restricts both numeric and option-object TCP listeners to loopback', () => {
  const code = `const http = require('node:http');
    const a = http.createServer(), b = http.createServer();
    a.listen(0, () => { console.log(a.address().address); a.close(); });
    b.listen({port: 0, host: '0.0.0.0'}, () => { console.log(b.address().address); b.close(); });`;
  const result = spawnSync(process.execPath, ['--require', require.resolve('../scripts/marp-loopback.cjs'), '-e', code], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n'), ['127.0.0.1', '127.0.0.1']);
});

test('preview streams native HTTP, authentication and binary WebSockets without mixing origins', { timeout: 15000 }, async t => {
  let fixtureCookie = 'unrelated=synthetic-test-only';
  const seen = [];
  const backends = [];
  const connections = new Set();
  function backend(terminal) {
    const server = http.createServer((req, res) => {
      seen.push({ terminal, path: req.url, cookie: req.headers.cookie });
      if (terminal && req.headers['x-slides-user'] !== 'local') {
        res.writeHead(401); return res.end('proxy authorization required');
      }
      const type = req.url.includes('?pdf') ? 'application/pdf' : 'text/html';
      res.writeHead(200, { 'content-type': type, 'x-frame-options': 'DENY' });
      res.end(terminal ? 'native-ttyd-fixture' : (type === 'application/pdf' ? '%PDF-fixture' : 'native-marp-fixture'));
    });
    server.on('connection', socket => { connections.add(socket); socket.on('close', () => connections.delete(socket)); });
    const wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
      if (terminal && req.headers['x-slides-user'] !== 'local') return socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      wss.handleUpgrade(req, socket, head, ws => {
        ws.send('ready');
        ws.on('message', (data, isBinary) => ws.send(data, { binary: isBinary }));
      });
    });
    backends.push(server);
    return server;
  }
  t.after(() => { for (const socket of connections) socket.destroy(); for (const server of backends) server.close(); });
  const marpPort = await listen(backend(false));
  const ttydPort = await listen(backend(true));
  const port = await freePort();
  let starts = 0;
  const proxy = await startPreview({ port, marpPort, entry: 'slides.md',
    backend: { session: '</script>synthetic', start: async () => { starts++; return ttydPort; }, close() {} } });
  t.after(proxy.close);
  const shell = await request(port, '/slides.md');
  assert.equal(shell.status, 200);
  assert.ok(shell.body.includes('terminal-panel'));
  assert.ok(!shell.body.includes('</script>synthetic'));
  assert.ok(shell.body.includes('\\u003c/script>synthetic'));
  assert.equal(shell.headers['x-frame-options'], 'DENY');
  assert.equal((await request(port, '/')).headers.location, '/slides.md');
  const native = await request(port, '/__slides__/slides.md', { headers: { cookie: fixtureCookie } });
  assert.equal(native.body, 'native-marp-fixture');
  assert.equal(seen.at(-1).cookie, undefined, 'never forward terminal cookies to Marp');
  assert.equal((await request(port, '/slides.md?pdf')).body, '%PDF-fixture');
  assert.equal((await request(port, '/__preview__/preview-proxy.cjs')).status, 404);
  assert.equal((await request(port, '/slides.md', { headers: { host: 'untrusted.example' } })).status, 403);
  assert.equal(starts, 0, 'viewing slides does not start ttyd or a shell');
  assert.equal((await request(proxy.terminalPort, '/')).status, 403);
  assert.equal((await request(proxy.terminalPort, '/__connect/wrong')).status, 403);
  const config = JSON.parse(shell.body.match(/id="preview-config">(.*?)<\/script>/)[1]);
  const connectPath = new URL(config.terminalURL).pathname;
  const terminalOrigin = `http://127.0.0.1:${proxy.terminalPort}`;
  assert.equal((await request(proxy.terminalPort, connectPath, { headers: { origin: 'https://untrusted.example' } })).status, 403);
  assert.equal(starts, 0);
  const bootstrap = await request(proxy.terminalPort, connectPath);
  assert.equal(bootstrap.status, 303);
  assert.equal(bootstrap.headers.location, '/');
  assert.ok(bootstrap.headers['set-cookie'][0].includes('HttpOnly; SameSite=Strict'));
  fixtureCookie = bootstrap.headers['set-cookie'][0].split(';')[0];
  assert.equal(starts, 1, 'click bootstraps the backend without a login form');
  const terminalPage = await request(proxy.terminalPort, '/', { headers: { cookie: fixtureCookie } });
  assert.equal(terminalPage.status, 200);
  assert.equal(terminalPage.headers['x-frame-options'], undefined);
  assert.ok(terminalPage.headers['content-security-policy'].includes("script-src 'self' 'unsafe-inline'"), 'native ttyd bundles inline JS');
  assert.ok(terminalPage.headers['content-security-policy'].includes(`frame-ancestors http://127.0.0.1:${port}`));
  assert.equal(seen.at(-1).cookie, undefined, 'proxy capability never goes to ttyd');
  assert.equal((await request(proxy.terminalPort, '/', { method: 'POST', headers: { origin: `http://127.0.0.1:${port}`, cookie: fixtureCookie } })).status, 403);

  async function rejectedUpgrade(headers, status) {
    const ws = new WebSocket(`ws://127.0.0.1:${proxy.terminalPort}/ws`, { headers });
    ws.on('error', () => {});
    const response = await new Promise(resolve => ws.once('unexpected-response', (_req, res) => resolve(res)));
    assert.equal(response.statusCode, status);
    response.resume(); ws.terminate();
  }
  await rejectedUpgrade({ Origin: terminalOrigin }, 403);
  await rejectedUpgrade({ Origin: terminalOrigin, Cookie: 'wrong=credential' }, 403);
  await rejectedUpgrade({ Origin: 'https://untrusted.example', Cookie: fixtureCookie }, 403);
  for (const [wsPort, wsPath, headers] of [
    [proxy.terminalPort, '/ws', { Origin: terminalOrigin, Cookie: fixtureCookie }],
    [port, '/.__marp-cli-watch-notifier__/synthetic', { Origin: `http://127.0.0.1:${port}` }],
  ]) {
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}${wsPath}`, { headers });
    t.after(() => ws.terminate());
    const ready = once(ws, 'message');
    await once(ws, 'open');
    assert.equal((await ready)[0].toString(), 'ready');
    const text = once(ws, 'message'); ws.send('中文 fish → harness');
    const [textData, binary] = await text;
    assert.equal(binary, false); assert.equal(textData.toString(), '中文 fish → harness');
    for (let n = 0; n < 3; n++) {
      const input = Buffer.alloc(512 * 1024, n);
      const echo = once(ws, 'message'); ws.send(input);
      const [output, isBinary] = await echo;
      assert.equal(isBinary, true); assert.equal(Buffer.compare(input, output), 0);
    }
    ws.close(); await once(ws, 'close');
  }
  await proxy.close();
  await assert.rejects(request(port, '/slides.md'));
});

test('missing native executables fail lazily and can be cleaned up without user state', async () => {
  const backend = createTerminalBackend({ cwd: '/synthetic-unavailable', env: { PATH: '/synthetic-missing-bin' } });
  await assert.rejects(backend.start(), /Missing terminal tool: ttyd/);
  await backend.close();
});

test('missing ttyd tools give setup guidance without affecting slides', async t => {
  const marp = http.createServer((_req, res) => res.end('slides still available'));
  const marpPort = await listen(marp);
  t.after(() => marp.close());
  const port = await freePort();
  const proxy = await startPreview({ port, marpPort, entry: 'example.md',
    backend: { session: 'fixture', start: async () => { throw new Error('missing fixture tool'); }, close() {} } });
  t.after(proxy.close);
  const shell = await request(port, '/example.md');
  const config = JSON.parse(shell.body.match(/id="preview-config">(.*?)<\/script>/)[1]);
  const response = await request(proxy.terminalPort, new URL(config.terminalURL).pathname);
  assert.equal(response.status, 502);
  assert.ok(response.body.includes('ttyd'));
  assert.equal((await request(port, '/__slides__/example.md')).body, 'slides still available');
});
