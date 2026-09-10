// Real CLI/HTTP/WebSocket test, with synthetic HOME/config/socket state only. No browser or model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const postcss = require('postcss');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { StringDecoder } = require('node:string_decoder');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const { startPreview } = require('../scripts/preview-proxy.cjs');
const { createTerminalBackend, sessionName } = require('../scripts/terminal-backend.cjs');
const { WebSocket } = createRequire(require.resolve('@marp-team/marp-cli/package.json'))('ws');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort() {
  const server = http.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
function request(target, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = typeof target === 'number' ? { hostname: '127.0.0.1', port: target } : { socketPath: target };
    const req = http.get({ ...address, path: pathname, headers }, res => {
      let data = ''; res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      res.on('error', reject);
    });
    req.setTimeout(10000, () => req.destroy(new Error('test HTTP timeout')));
    req.on('error', reject);
  });
}

test('one-click native ttyd starts fish, protects its socket, and preserves one process across clients and preview restarts', {
  skip: process.env.TTYD_TEST !== '1' ? 'opt in with TTYD_TEST=1 bun run check' : false,
  timeout: 90000,
}, async t => {
  const temporary = fs.mkdtempSync('/tmp/slides-terminal-test-');
  const home = path.join(temporary, 'home'), configDir = path.join(temporary, 'config');
  const dataDir = path.join(temporary, 'data'), runtime = path.join(temporary, 'runtime'), tmp = path.join(temporary, 'tmp');
  for (const dir of [home, configDir, dataDir, runtime, tmp]) fs.mkdirSync(dir, { mode: 0o700 });
  const env = { PATH: process.env.PATH, HOME: home, SHELL: '/bin/sh', TERM: 'xterm-256color', LANG: 'en_US.UTF-8',
    TMPDIR: tmp, XDG_CONFIG_HOME: configDir, XDG_DATA_HOME: dataDir, XDG_CACHE_HOME: path.join(temporary, 'cache'),
    XDG_RUNTIME_DIR: runtime, ZELLIJ_SOCKET_DIR: runtime, ZELLIJ_CONFIG_DIR: configDir };
  const config = path.join(configDir, 'config.kdl');
  fs.writeFileSync(config, 'web_server false\nweb_sharing "off"\nsession_serialization false\ndisable_session_metadata true\n' +
    'show_startup_tips false\nshow_release_notes false\non_force_close "detach"\n');
  const proxies = new Set(), clients = new Set(), socketPaths = [];
  const session = sessionName(home);
  const fixtureSocket = path.join(runtime, 'contract_version_1', session);
  t.after(async () => {
    for (const ws of clients) ws.terminate();
    for (const proxy of proxies) await proxy.close();
    spawnSync('zellij', ['--config', config, 'kill-session', session], { cwd: home, env, stdio: 'ignore', timeout: 10000 });
    for (let n = 0; n < 30 && fs.existsSync(fixtureSocket); n++) await delay(100);
    fs.rmSync(temporary, { recursive: true, force: true });
    for (const socket of socketPaths) assert.equal(fs.existsSync(path.dirname(socket)), false, 'owned ttyd socket directory must be removed');
  });
  for (const command of ['ttyd', 'zellij', 'fish']) {
    assert.equal(spawnSync(command, ['--version'], { env, stdio: 'ignore', timeout: 5000 }).status, 0, `${command} required`);
  }
  const fixture = path.join(temporary, 'fixture.py');
  fs.writeFileSync(fixture, 'import sys\nprint("FIXTURE_READY", flush=True)\nfor i, line in enumerate(sys.stdin, 1):\n print(f"FIXTURE_{i}:{line.strip()[::-1]}", flush=True)\n');

  async function preview(selected = '') {
    const backend = createTerminalBackend({ cwd: home, session: selected, env });
    const port = await freePort();
    const proxy = await startPreview({ port, marpPort: await freePort(), entry: 'slides.md', backend });
    proxies.add(proxy);
    const shell = await request(port, '/slides.md');
    const config = JSON.parse(shell.data.match(/id="preview-config">(.*?)<\/script>/)[1]);
    const bootstrap = await request(proxy.terminalPort, new URL(config.terminalURL).pathname);
    assert.equal(bootstrap.status, 303, 'one click should start ttyd without manual login');
    const cookie = bootstrap.headers['set-cookie'][0].split(';')[0];
    const page = await request(proxy.terminalPort, '/', { cookie });
    assert.equal(page.status, 200);
    assert.ok(page.data.includes('ttyd'));
    assert.ok(page.headers['content-security-policy'].includes("script-src 'self' 'unsafe-inline'"));
    const styles = [...page.data.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)];
    assert.ok(styles.length, 'inspect the installed native client, not just its theme preferences');
    for (const [, source] of styles) postcss.parse(source).walkRules(rule => {
      // xterm updates the viewport's background inline when its theme changes.
      // Structural ancestors must not paint an opaque backing behind that viewport.
      const ancestors = ['html', 'body', '#terminal-container', '#terminal-container .terminal', '.xterm', '.xterm .xterm-screen'];
      if (rule.selector.split(',').some(selector => ancestors.includes(selector.trim()))) {
        rule.walkDecls(/^(?:background|background-color)$/, decl => {
          assert.equal(decl.value, 'transparent', `native ${rule.selector} must not mask the transparent canvas`);
        });
      }
    });
    const socket = await backend.start(); // Already started by the click, same owned socket.
    socketPaths.push(socket);
    assert.equal(fs.statSync(socket).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(socket)).mode & 0o777, 0o700);
    assert.equal((await request(socket, '/')).status, 407, 'private ttyd socket also requires the auth-proxy header');
    return { proxy, cookie };
  }
  async function connect({ proxy, cookie }) {
    const origin = `http://127.0.0.1:${proxy.terminalPort}`;
    const ws = new WebSocket(`ws://127.0.0.1:${proxy.terminalPort}/ws`, ['tty'], { headers: { Cookie: cookie, Origin: origin } });
    clients.add(ws); ws.on('error', () => {});
    let output = '', preferences;
    const decoder = new StringDecoder('utf8');
    const oscRgb = color => color.slice(1, 7).match(/../g).map(channel => channel.repeat(2)).join('/');
    const input = text => ws.send(Buffer.from('0' + text));
    ws.on('message', raw => {
      const type = raw[0];
      if (type === 50) { preferences = JSON.parse(raw.subarray(1).toString()); return; }
      if (type !== 48) return;
      const text = decoder.write(raw.subarray(1)); // PTY/WS boundaries need not align with UTF-8 characters.
      output = (output + text).slice(-200000);
      // Answer native terminal capability queries (not a browser renderer).
      if (text.includes('\x1b[c') || text.includes('\x1b[0c')) input('\x1b[?62;4c');
      if (text.includes('\x1b[6n')) input('\x1b[1;1R');
      if (text.includes('\x1b]10;?')) input(`\x1b]10;rgb:${oscRgb(preferences?.theme?.foreground || '#d2d2d2')}\x1b\\`);
      if (text.includes('\x1b]11;?')) input(`\x1b]11;rgb:${oscRgb(preferences?.theme?.background || '#2b2b2b')}\x1b\\`);
    });
    await once(ws, 'open');
    ws.send(JSON.stringify({ AuthToken: '', columns: 120, rows: 32 }));
    async function waitFor(marker) {
      for (let n = 0; n < 400; n++) {
        if (output.includes(marker)) return;
        await delay(50);
      }
      assert.fail(`synthetic terminal did not emit ${marker}; output length=${output.length}`);
    }
    return { input, waitFor, resize: () => ws.send('1' + JSON.stringify({ columns: 100, rows: 30 })),
      get preferences() { return preferences; },
      async close() {
        if (ws.readyState !== WebSocket.CLOSED) {
          const closed = once(ws, 'close'); ws.close();
          const timer = setTimeout(() => ws.terminate(), 1000);
          try { await closed; } finally { clearTimeout(timer); }
        }
        clients.delete(ws);
      } };
  }
  assert.equal(fs.existsSync(fixtureSocket), false);
  const firstPreview = await preview();
  assert.equal(fs.existsSync(fixtureSocket), false, 'loading ttyd HTML alone must not create a session');
  const first = await connect(firstPreview);
  await first.waitFor('fish');
  first.input(`python3 -u "${fixture}"\r`);
  await first.waitFor('FIXTURE_READY');
  assert.equal(first.preferences.fontFamily, 'MD IO, Symbols Nerd Font Mono, Menlo, monospace', 'keep MD IO primary and explicitly fall back for Nerd Font icons');
  assert.equal(first.preferences.allowTransparency, true, 'native canvas alpha must be enabled, not simulated with iframe opacity');
  assert.equal(first.preferences.minimumContrastRatio, 4.5, 'let the native renderer also strengthen low-contrast application colors');
  assert.equal(first.preferences.theme.background, '#e8e8e800', 'transparent neutral off-white RGB for light terminal detection');
  assert.equal(first.preferences.theme.foreground, '#3f3326', 'opaque warm-brown text, not pure black');
  assert.equal(first.preferences.theme.cursor, '#3f3326');
  const css = postcss.parse(fs.readFileSync(require.resolve('../scripts/preview-drawer.css'), 'utf8'));
  let glass;
  css.walkRules('#terminal-panel', rule => rule.walkDecls('background', decl => { glass = decl.value; }));
  const [, ...rgba] = glass.match(/^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/);
  const [r, g, b, alpha] = rgba.map(Number);
  assert.equal(first.preferences.theme.background.slice(1, 7), [r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join(''));
  const luminance = rgb => rgb.map(channel => channel / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  // Conservative CSS color calculation over black: not a GPU or visual test.
  const darkestGlass = luminance([r, g, b].map(channel => channel * alpha / 100));
  for (const name of ['foreground', 'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite']) {
    const color = first.preferences.theme[name];
    assert.match(color, /^#[0-9a-f]{6}$/, `${name} glyphs remain opaque`);
    const foreground = luminance(color.slice(1).match(/../g).map(channel => parseInt(channel, 16)));
    assert.ok((darkestGlass + 0.05) / (foreground + 0.05) >= 4.5, `${name} must stay readable even over a dark slide`);
  }
  assert.ok(Object.keys(first.preferences).indexOf('allowTransparency') < Object.keys(first.preferences).indexOf('theme'));
  assert.equal(first.preferences.disableLeaveAlert, true);
  assert.equal(first.preferences.disableResizeOverlay, true);
  first.input('first\r'); await first.waitFor('FIXTURE_1:tsrif');
  await first.close();
  const second = await connect(firstPreview);
  await second.waitFor('FIXTURE_1:tsrif');
  second.resize(); second.input('second\r'); await second.waitFor('FIXTURE_2:dnoces');
  const simultaneous = await connect(firstPreview);
  await simultaneous.waitFor('FIXTURE_2:dnoces');
  second.input('third\r'); await simultaneous.waitFor('FIXTURE_3:driht');
  await firstPreview.proxy.close();
  await second.close(); await simultaneous.close();
  const reopened = await preview(session); // Explicitly selecting the same session also preserves it.
  const last = await connect(reopened);
  await last.waitFor('FIXTURE_3:driht');
  last.input('fourth\r'); await last.waitFor('FIXTURE_4:htruof');
  // eza 0.23.5 icons for Python, JavaScript, README and src, plus ordinary Unicode.
  // This proves transport and Python processing, not browser glyph rendering.
  const unicode = '中文 λ ✓ \ue606 \ue74e \u{f00ba} \u{f08de}';
  last.input(unicode + '\r');
  await last.waitFor(`FIXTURE_5:${Array.from(unicode).reverse().join('')}`);
  await last.close();
});
