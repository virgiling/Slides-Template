"""HTTP-only integration test for native Marp server mode; no browser tools."""

import json
import hashlib
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless((ROOT / 'node_modules/.bin/marp').is_file(), 'run make install for HTTP integration tests')
class MarpServerTests(unittest.TestCase):
    def test_occupied_preview_port_fails_and_cleans_up_its_children(self):
        with tempfile.TemporaryDirectory(prefix='slides-port-test-') as temporary:
            project = Path(temporary) / 'talk'
            project.mkdir()
            (project / 'slides.md').write_text('> [!aigc]\n> # Synthetic fixture\n')
            (project / 'theme.css').write_text("/* @theme fixture */\n@import 'default';\n")
            with socket.socket() as occupied:
                occupied.bind(('127.0.0.1', 0))
                occupied.listen()
                port = occupied.getsockname()[1]
                result = subprocess.run(
                    [sys.executable, str(ROOT / 'scripts/serve-marp.py'), str(project), 'slides.md', '--port', str(port)],
                    env={**os.environ, 'TMPDIR': temporary, 'PYTHONDONTWRITEBYTECODE': '1'},
                    capture_output=True, text=True, timeout=15)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Cannot start local preview', result.stderr)
            self.assertEqual(list(Path(temporary).glob('slides-marp-serve-*')), [])

    def test_live_content_theme_assets_and_private_file_isolation(self):
        with tempfile.TemporaryDirectory(prefix='slides-http-test-') as temporary:
            workspace = Path(temporary) / 'workspace'
            project = workspace / 'talk'
            (workspace / 'scripts').mkdir(parents=True)
            (workspace / 'node_modules').symlink_to(ROOT / 'node_modules')
            (project / 'assets').mkdir(parents=True)
            shutil.copy2(ROOT / 'scripts/serve-marp.py', workspace / 'scripts/serve-marp.py')
            for helper in ('marp-engine.cjs', 'presentation-keys.cjs', 'marp-loopback.cjs',
                           'preview-proxy.cjs', 'preview.html', 'preview-drawer.mjs', 'preview-drawer.css',
                           'terminal-backend.cjs', 'terminal-layout.kdl'):
                shutil.copy2(ROOT / 'scripts' / helper, workspace / 'scripts' / helper)
            source = project / 'slides.md'
            source.write_text('---\ntheme: virgiling\nmath: katex\n---\n> [!aigc]\n> # HTTP_INITIAL\n>\n> $x^2$\n')
            shutil.copy2(ROOT / 'template/marp/theme.css', project / 'theme.css')
            badge = (ROOT / 'template/marp/assets/aigc-badge.png').read_bytes()
            (project / 'assets/aigc-badge.png').write_bytes(badge)
            (project / 'assets/figure.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"><title>ASSET_INITIAL</title></svg>')
            # Synthetic fixtures only: no real private files are read or requested.
            (project / '.claude').mkdir()
            (project / '.claude/secret.md').write_text('PRIVATE_SENTINEL')
            (project / 'AGENT.md').write_text('PRIVATE_SENTINEL')
            (project / 'private.db').write_text('PRIVATE_SENTINEL')
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            env = {**os.environ, 'TMPDIR': temporary, 'PYTHONDONTWRITEBYTECODE': '1'}
            process = subprocess.Popen(
                [sys.executable, str(workspace / 'scripts/serve-marp.py'), str(project), 'slides.md', '--port', str(port)],
                cwd=workspace, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
            )
            base = f'http://127.0.0.1:{port}'

            def request(path):
                with urlopen(base + path, timeout=3) as response:
                    return response.read().decode('utf-8')

            def wait_for(path, marker):
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise AssertionError('server exited: ' + process.communicate()[0])
                    try:
                        body = request(path)
                        if marker in body:
                            return body
                    except HTTPError as error:
                        error.close()
                    except (URLError, TimeoutError):
                        pass
                    time.sleep(0.15)
                raise AssertionError(f'timed out waiting for {marker} at {path}')

            try:
                shell = wait_for('/slides.md', 'preview-config')
                self.assertIn('terminal-panel', shell)
                config = json.loads(re.search(r'id="preview-config">(.*?)</script>', shell).group(1))
                terminal_port = int(config['terminalOrigin'].rsplit(':', 1)[1])
                expected_session = 'slides-' + hashlib.sha256(str(project.resolve()).encode()).hexdigest()[:10]
                self.assertEqual(config['session'], expected_session, 'terminal cwd must be the source talk, not its temporary public mirror')
                self.assertNotIn('HTTP_INITIAL', shell, 'native player stays in a separate frame')
                self.assertIn('terminalURL', request('/__preview__/preview-drawer.mjs'))
                body = request('/__slides__/slides.md')
                self.assertIn('HTTP_INITIAL', body, 'first iframe request must not race Marp startup')
                self.assertNotIn('terminal-panel', body, 'do not inject terminal code into the Marp render')
                self.assertTrue('#015cad' in body and '#003865' in body, 'custom theme palette should be embedded')
                self.assertIn('class="callout aigc"', body)
                self.assertIn('<math ', body)
                self.assertIn('data-slide-key-aliases', body)
                self.assertIn('ASSET_INITIAL', request('/assets/figure.svg'))
                with urlopen(base + '/assets/aigc-badge.png', timeout=3) as response:
                    self.assertEqual(response.read(), badge)
                for path in ('/.claude/secret.md', '/private.db', '/AGENT.md', '/marp-engine.cjs'):
                    with self.assertRaises(HTTPError) as error:
                        request(path)
                    self.assertIn(error.exception.code, (403, 404))
                    error.exception.close()
                watcher = re.search(r'/\.__marp-cli-watch-notifier__/[a-f0-9]+', body).group()
                # Listen to the actual native watcher over the proxy before editing the fixture.
                watch_test = r'''
const fs = require('node:fs');
const { createRequire } = require('node:module');
const WS = createRequire(require.resolve('@marp-team/marp-cli/package.json'))('ws');
const [port, path, source] = process.argv.slice(1);
const ws = new WS(`ws://127.0.0.1:${port}${path}`, { headers: { Origin: `http://127.0.0.1:${port}` } });
const timeout = setTimeout(() => { ws.terminate(); process.exitCode = 1; }, 12000);
ws.on('message', data => {
  if (String(data) === 'ready') fs.writeFileSync(source, fs.readFileSync(source, 'utf8').replace('HTTP_INITIAL', 'HTTP_UPDATED'));
  if (String(data) === 'reload') { clearTimeout(timeout); console.log('native reload'); ws.close(); }
});
ws.on('error', () => { clearTimeout(timeout); process.exitCode = 1; });
'''
                checked = subprocess.run(['node', '-e', watch_test, str(port), watcher, str(source)],
                                         cwd=ROOT, capture_output=True, text=True, timeout=15)
                self.assertEqual(checked.returncode, 0, checked.stderr)
                self.assertIn('native reload', checked.stdout)
                wait_for('/__slides__/slides.md', 'HTTP_UPDATED')
                with (project / 'theme.css').open('a') as stream:
                    stream.write('\n/* THEME_UPDATED */\n')
                wait_for('/theme.css', 'THEME_UPDATED')
                (project / 'assets/figure.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"><title>ASSET_UPDATED</title></svg>')
                wait_for('/assets/figure.svg', 'ASSET_UPDATED')
            finally:
                process.terminate()
                try:
                    output, _ = process.communicate(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    output, _ = process.communicate()
            self.assertEqual(process.returncode, 0, output)
            self.assertEqual(list(Path(temporary).glob('slides-marp-serve-*')), [])
            for closed_port in (port, terminal_port):
                with socket.socket() as sock:
                    self.assertNotEqual(sock.connect_ex(('127.0.0.1', closed_port)), 0)


if __name__ == '__main__':
    unittest.main()
