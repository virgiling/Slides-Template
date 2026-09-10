"""A template-only checkout must bootstrap without accessing the original workspace."""

import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SKILL = '.agents/skills/init-slides-os'
INIT = f'{SKILL}/scripts/init_workspace.py'
ASSETS = f'{SKILL}/assets'
spec = importlib.util.spec_from_file_location('bootstrap_package', ROOT / 'scripts/package-bootstrap.py')
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)
TEMPLATE_FILES = (
    '.gitignore', 'LICENSE.txt', 'AGENT.md', 'README.md',
    'docs/setup.md', 'docs/customization.md', 'docs/terminal.md',
    'latex/AGENT.md', 'latex/README.md', 'latex/example.tex', 'latex/virgiling-slides.cls',
    'latex/references.bib', 'latex/thumbnail.png', 'latex/.zed/tasks.json',
    'marp/AGENT.md', 'marp/README.md', 'marp/example.md', 'marp/theme.css', 'marp/thumbnail.png',
    'marp/assets/workflow.svg', 'marp/assets/aigc-badge.png',
    f'{SKILL}/SKILL.md', INIT, '.agents/skills/make-marp-slides/SKILL.md', f'{ASSETS}/manifest.json',
)


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='slides-bootstrap-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'workspace with spaces'
        self.template = self.root / 'template'
        resources = [f'{ASSETS}/' + packer.asset_name(path) for path in packer.FILES]
        # Explicit public source allowlist, not a recursive clone of local private state.
        for relative in (*TEMPLATE_FILES, *resources):
            source, target = ROOT / 'template' / relative, self.template / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        self.env = {'PATH': os.environ['PATH'], 'HOME': str(Path(self.temp.name) / 'home'),
                    'XDG_CONFIG_HOME': str(Path(self.temp.name) / 'config'), 'LANG': 'en_US.UTF-8',
                    'BUN_INSTALL_CACHE_DIR': str(Path(self.temp.name) / 'bun-cache'),
                    'PYTHONDONTWRITEBYTECODE': '1'}
        Path(self.env['HOME']).mkdir()
        Path(self.env['XDG_CONFIG_HOME']).mkdir()

    def run_command(self, args, ok=True, timeout=30):
        result = subprocess.run(args, cwd=self.root, env=self.env, text=True, capture_output=True, timeout=timeout)
        if ok:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def initialize(self, *args, ok=True):
        return self.run_command(['python3', str(self.template / INIT), *args], ok=ok)

    def test_snapshot_matches_public_workspace_sources(self):
        result = subprocess.run(['python3', str(ROOT / 'scripts/package-bootstrap.py'), '--check'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        manifest = json.loads((self.template / ASSETS / 'manifest.json').read_text())
        self.assertEqual([item['path'] for item in manifest['files']], list(packer.FILES))
        self.assertFalse((self.template / ASSETS / 'workspace/.gitignore').exists())

    def test_template_only_bootstrap_is_idempotent_and_installs_skill_entries(self):
        self.initialize('--check')
        self.assertFalse((self.root / 'Makefile').exists())
        self.initialize()
        self.assertTrue((self.root / 'scripts/slides').stat().st_mode & 0o111)
        self.assertFalse((self.root / 'node_modules').exists(), 'bootstrap must not install dependencies')
        self.assertFalse((self.root / '.git').exists(), 'bootstrap must not initialize Git')
        self.assertIn('Slides workspace commands', self.run_command(['make', 'help']).stdout)
        self.run_command(['make', 'new', 'NAME=demo', 'TYPE=marp'])
        self.assertTrue((self.root / 'demo/slides.md').is_file())
        self.assertFalse((self.root / 'demo/scripts').exists())
        result = self.initialize()
        self.assertIn('Created 0 files', result.stdout)
        for name in ('init-slides-os', 'make-marp-slides'):
            wrapper = self.root / f'.agents/skills/{name}/SKILL.md'
            self.assertIn(f'../../../template/.agents/skills/{name}/SKILL.md', wrapper.read_text())
        self.assertFalse((self.root / 'docs').exists(), 'usage docs have one source under template')

    def test_conflicts_are_preflighted_without_partial_writes(self):
        (self.root / 'README.md').write_text('unrelated existing work')
        self.assertIn('Existing files differ', self.initialize(ok=False).stderr)
        self.assertEqual((self.root / 'README.md').read_text(), 'unrelated existing work')
        self.assertFalse((self.root / 'scripts').exists())
        self.assertFalse((self.root / '.gitignore').exists())

    def test_symbolic_destination_is_rejected(self):
        outside = Path(self.temp.name) / 'unrelated'; outside.mkdir()
        (self.root / 'scripts').symlink_to(outside, target_is_directory=True)
        self.assertIn('Symbolic', self.initialize(ok=False).stderr)
        self.assertEqual(list(outside.iterdir()), [])
        self.assertFalse((self.root / 'Makefile').exists())

    def test_symbolic_template_and_wrong_clone_location_are_rejected(self):
        alias = Path(self.temp.name) / 'alias'
        alias.mkdir()
        (alias / 'template').symlink_to(self.template, target_is_directory=True)
        result = self.run_command(['python3', str(alias / 'template' / INIT)], ok=False)
        self.assertIn('Symbolic', result.stderr)
        wrong = self.root / 'wrong-name'
        self.template.rename(wrong)
        self.template = wrong
        self.assertIn('Place this repository', self.initialize(ok=False).stderr)
        self.assertFalse((self.root / 'Makefile').exists())

    def test_corrupt_resource_and_unsafe_manifest_are_rejected(self):
        manifest_path = self.template / ASSETS / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        resource = self.template / ASSETS / manifest['files'][0]['asset']
        original = resource.read_bytes()
        resource.write_bytes(b'corrupt fixture')
        self.assertIn('checksum mismatch', self.initialize(ok=False).stderr)
        resource.write_bytes(original)
        manifest['files'][0]['path'] = '../escape'
        manifest_path.write_text(json.dumps(manifest))
        self.assertIn('Unsafe resource path', self.initialize(ok=False).stderr)
        self.assertFalse((self.root.parent / 'escape').exists())
        self.assertFalse((self.root / 'Makefile').exists())

    def test_skill_metadata_and_local_document_links(self):
        for name in ('init-slides-os', 'make-marp-slides'):
            skill = self.template / f'.agents/skills/{name}/SKILL.md'
            text = skill.read_text()
            header = text.split('\n---\n', 1)[0]
            self.assertTrue(text.startswith('---\n'))
            self.assertRegex(header, rf'(?m)^name: {name}$')
            self.assertRegex(name, r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
            description = re.search(r'(?m)^description: (.+)$', header).group(1)
            self.assertTrue(1 <= len(description) <= 1024)
        for relative in TEMPLATE_FILES:
            if not relative.endswith('.md'):
                continue
            source = self.template / relative
            for link in re.findall(r'\]\(([^\s)]+)\)', source.read_text()):
                if '://' in link or link.startswith(('#', 'data:')):
                    continue
                self.assertTrue((source.parent / link.split('#')[0]).exists(), f'{relative}: {link}')

    @unittest.skipUnless(os.environ.get('SLIDES_TEST_BOOTSTRAP') == '1',
                         'opt in with SLIDES_TEST_BOOTSTRAP=1; installs locked dependencies in a temporary workspace')
    def test_fresh_bootstrap_installs_and_compiles_the_full_marp_example(self):
        self.initialize()
        self.run_command(['make', 'install'], timeout=180)
        self.run_command(['make', 'doctor', 'TYPE=marp'])
        self.run_command(['make', 'build-template', 'TYPE=marp'], timeout=60)
        html = (self.template / 'marp/build/example.html').read_text()
        for marker in ('class="callout aigc"', '<math ', 'data-slide-key-aliases'):
            self.assertIn(marker, html)
        self.assertNotIn('terminal-panel', html)
        self.assertTrue((self.template / 'marp/build/assets/aigc-badge.png').exists())
        self.run_command(['make', 'new', 'NAME=demo', 'TYPE=marp'])
        self.run_command(['make', 'build', 'SLIDE=demo'], timeout=60)
        self.assertTrue((self.root / 'demo/build/slides.html').is_file())
        self.run_command(['bun', 'run', 'check'], timeout=90)


if __name__ == '__main__':
    unittest.main()
