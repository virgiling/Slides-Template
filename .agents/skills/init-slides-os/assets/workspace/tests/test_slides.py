"""Manager contract tests: isolated fixtures, compiler stubs, no browser tools."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


WORKSPACE = Path(__file__).resolve().parents[1]


class SlidesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="slides-manager-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "workspace with spaces"
        (self.root / "scripts").mkdir(parents=True)
        shutil.copy2(WORKSPACE / "scripts/slides", self.root / "scripts/slides")
        for helper in ('copy-assets.cjs', 'marp-engine.cjs', 'presentation-keys.cjs'):
            shutil.copy2(WORKSPACE / 'scripts' / helper, self.root / 'scripts' / helper)
        shutil.copy2(WORKSPACE / "Makefile", self.root / "Makefile")
        sources = {
            "latex": ["example.tex", "virgiling-slides.cls", "references.bib"],
            "marp": ["example.md", "theme.css", "assets/workflow.svg", "assets/aigc-badge.png"],
        }
        for kind, names in sources.items():
            for name in names:
                source = WORKSPACE / "template" / kind / name
                target = self.root / "template" / kind / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
            # Synthetic sentinels only; no real private directories are inspected.
            for name in (".claude/SENTINEL", "build/SENTINEL", "node_modules/SENTINEL", "README.md"):
                target = self.root / "template" / kind / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("DO NOT COPY")
        for name in (".gitignore", "LICENSE.txt"):
            shutil.copy2(WORKSPACE / "template" / name, self.root / "template" / name)
        self.bin = self.root / "fake-bin"
        self.bin.mkdir()
        compiler = '''#!/usr/bin/env python3
import os
from pathlib import Path
import sys
name = Path(sys.argv[0]).name
args = sys.argv[1:]
if name in ('open', 'displayline'):
    raise SystemExit('Viewer must not run in tests')
if os.environ.get('FAIL_BUILD') == '1':
    raise SystemExit(9)
if name == 'tectonic':
    output = Path('build') / (Path(args[2]).stem + '.pdf')
elif name == 'bun' and args[0] == 'install':
    p = Path('node_modules/.bin/marp')
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(Path(sys.argv[0]).read_text())
    p.chmod(0o755)
    raise SystemExit(0)
elif name == 'marp':
    assert '--engine' in args, 'must use the same shared engine for every render path'
    assert Path(args[args.index('--engine') + 1]).is_file()
    output = Path(args[args.index('--output') + 1])
else:
    raise SystemExit('Unexpected invocation: ' + repr(args))
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text('%PDF-stub' if output.suffix == '.pdf' else '<!doctype html>')
'''
        for name in ("tectonic", "bun", "open"):
            file = self.bin / name
            file.write_text(compiler)
            file.chmod(0o755)
        self.env = os.environ.copy()
        for key in ("TYPE", "SLIDE", "NAME", "FORMAT", "FILE", "ZED_FILE", "ZED_ROW", "LINE", "CONFIRM", "FAIL_BUILD", "PORT", "ZELLIJ_PORT", "ZELLIJ_SESSION", "TERMINAL_SESSION"):
            self.env.pop(key, None)
        self.env["PATH"] = str(self.bin) + os.pathsep + self.env["PATH"]

    def command(self, action, expected=0, **values):
        result = subprocess.run(
            ["sh", str(self.root / "scripts/slides"), action],
            cwd=self.root, env={**self.env, **values}, capture_output=True, text=True,
        )
        if expected == 0:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def create(self, name="talk", kind="latex"):
        self.command("new", NAME=name, TYPE=kind)
        return self.root / name

    def test_make_defaults_to_latex_and_preserves_template(self):
        result = subprocess.run(["make", "new", "NAME=legacy"], cwd=self.root, env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        talk = self.root / "legacy"
        self.assertTrue((talk / "main.tex").exists())
        self.assertEqual((talk / "main.tex").read_bytes(), (self.root / "template/latex/example.tex").read_bytes())
        self.assertFalse((talk / "example.tex").exists())
        self.command("build", SLIDE="legacy")
        self.assertTrue((talk / "build/main.pdf").exists())

    def test_marp_project_installs_builds_and_exports_pdf(self):
        talk = self.create(kind="marp")
        self.command("build", SLIDE="talk", expected=1)
        self.command("install", SLIDE="talk")
        self.command("build", SLIDE="talk")
        self.command("build", SLIDE="talk", FORMAT="pdf")
        self.command("watch", SLIDE="talk")
        self.assertTrue((talk / "build/slides.html").exists())
        self.assertTrue((talk / "build/slides.pdf").exists())
        self.command("build", SLIDE="talk", FORMAT="txt", expected=1)

    def test_new_copies_only_allowlisted_sources_and_permanent_rules(self):
        for kind in ("latex", "marp"):
            talk = self.create(name=kind, kind=kind)
            for excluded in (".claude", "node_modules", "build", "README.md", "package.json", "scripts", "tests"):
                self.assertFalse((talk / excluded).exists(), excluded)
            policy = (talk / "AGENT.md").read_text()
            for phrase in ("visual models", "browser tools", "APIs", "English", "single-line", "rebase", "Permanent", "squash", "one final commit"):
                self.assertIn(phrase, policy)
            self.assertEqual((talk / ".gitignore").read_bytes(), (self.root / "template/.gitignore").read_bytes())
            self.assertIn('leave changes uncommitted until approval', policy)
            if kind == 'marp':
                self.assertIn('> [!aigc]', policy)
                self.assertIn('Cambria Math', policy)
                self.assertTrue((talk / 'assets/aigc-badge.png').is_file())

    def test_current_resolves_nested_sources_and_both_templates(self):
        talk = self.create()
        (talk / "sections").mkdir()
        active = talk / "sections/method.tex"
        active.write_text("section")
        self.command("build-current", FILE=str(active), LINE="bad")
        self.assertTrue((talk / "build/main.pdf").exists())
        self.command("build-current", FILE="template/latex/virgiling-slides.cls")
        self.assertTrue((self.root / "template/latex/build/example.pdf").exists())
        self.command("install")
        self.command("build-current", ZED_FILE=str(self.root / "template/marp/theme.css"), ZED_ROW="10")
        self.assertTrue((self.root / "template/marp/build/example.html").exists())
        self.command("build-current", FILE="template/.gitignore", expected=1)
        self.command("build-current", FILE="Makefile", expected=1)

    def test_build_all_and_clean_all_detect_types(self):
        self.create("formal")
        self.create("simple", "marp")
        self.command("install", SLIDE="simple")
        self.command("build-all")
        result = self.command("list").stdout
        for word in ("formal", "simple", "latex", "marp", "built"):
            self.assertIn(word, result)
        self.command("clean-all")
        for name in ("formal", "simple"):
            self.assertFalse((self.root / name / "build").exists())
            self.assertTrue((self.root / name / "AGENT.md").exists())

    def test_rejects_invalid_names_types_and_existing_content(self):
        for name in ("../escape", "template", "scripts", "tests", "bad name", "-bad", ".hidden"):
            self.command("new", NAME=name, expected=1)
        self.command("new", NAME="bad-type", TYPE="html", expected=1)
        self.assertFalse((self.root / "bad-type").exists())
        talk = self.create()
        self.command("new", NAME="talk", expected=1)
        self.assertTrue((talk / "main.tex").exists())
        (self.root / "empty").mkdir()
        self.command("new", NAME="empty")

    def test_rejects_ambiguous_entries(self):
        talk = self.create()
        (talk / "slides.md").write_text("ambiguous")
        self.command("build", SLIDE="talk", expected=1)
        self.assertFalse((talk / "build").exists())

    def test_rejects_symlink_projects_outputs_and_outside_current_files(self):
        talk = self.create()
        outside = Path(self.temp.name) / "outside"
        outside.mkdir()
        (outside / "keep").write_text("untouched")
        (outside / "main.tex").write_text("outside")
        (self.root / "linked").symlink_to(outside, target_is_directory=True)
        for action in ("new", "build", "clean", "delete"):
            self.command(action, NAME="linked", CONFIRM="linked", expected=1)
        (talk / "build").symlink_to(outside, target_is_directory=True)
        for action in ("build", "clean"):
            self.command(action, SLIDE="talk", expected=1)
        self.command("build-current", FILE=str(outside / "main.tex"), expected=1)
        self.assertEqual((outside / "keep").read_text(), "untouched")

    def test_delete_requires_exact_confirmation(self):
        talk = self.create()
        self.command("delete", SLIDE="talk", expected=1)
        self.command("delete", SLIDE="talk", CONFIRM="wrong", expected=1)
        self.assertTrue(talk.exists())
        self.command("delete", SLIDE="talk", CONFIRM="talk")
        self.assertFalse(talk.exists())

    def test_compiler_failure_propagates(self):
        self.create()
        self.command("build", SLIDE="talk", FAIL_BUILD="1", expected=1)
        self.assertFalse((self.root / "talk/build/main.pdf").exists())

    def test_missing_allowlisted_source_fails_before_creating_project(self):
        (self.root / "template/marp/theme.css").unlink()
        self.command("new", NAME="incomplete", TYPE="marp", expected=1)
        self.assertFalse((self.root / "incomplete").exists())

    def test_rejects_symbolic_template_asset_directory(self):
        assets = self.root / "template/marp/assets"
        outside = Path(self.temp.name) / "external-assets"
        assets.rename(outside)
        assets.symlink_to(outside, target_is_directory=True)
        self.command("new", NAME="unsafe", TYPE="marp", expected=1)
        self.assertFalse((self.root / "unsafe").exists())

    def test_serve_routes_named_template_and_current_files(self):
        helper = self.root / 'scripts/serve-marp.py'
        helper.write_text("import sys\nprint(' '.join(sys.argv[1:]))\n")
        self.command('install')
        self.assertIn('example.md --port 8080 --session', self.command('serve').stdout)
        self.assertIn('--session shared session', self.command('serve', TERMINAL_SESSION='shared session').stdout)
        self.assertIn('--session legacy', self.command('serve', ZELLIJ_SESSION='legacy').stdout)
        self.assertIn('--session current', self.command('serve', TERMINAL_SESSION='current', ZELLIJ_SESSION='legacy').stdout)
        self.command('serve', ZELLIJ_PORT='9002', expected=1)
        self.create('simple', 'marp')
        self.assertIn('slides.md --port 9090', self.command('serve', SLIDE='simple', PORT='9090').stdout)
        self.assertIn('slides.md --port 8080', self.command('serve-current', FILE='simple/theme.css').stdout)
        self.create('formal')
        self.command('serve', SLIDE='formal', expected=1)

    def test_thumbnail_tool_stays_in_outer_workspace(self):
        helper = self.root / 'scripts/thumbnails.py'
        helper.write_text("import sys\nprint(sys.argv[1])\n")
        self.assertIn('all', self.command('thumbnails').stdout)
        self.assertIn('marp', self.command('thumbnails', TYPE='marp').stdout)
        self.command('thumbnails', TYPE='invalid', expected=1)
        self.assertFalse((self.root / 'template/scripts').exists())

    def test_doctor_can_check_only_one_track(self):
        self.command("doctor", TYPE="latex")
        self.command("doctor", TYPE="marp", expected=1)
        self.command("install")
        self.command("doctor")


if __name__ == "__main__":
    unittest.main()
