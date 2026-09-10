#!/usr/bin/env python3
"""Materialize reviewed workspace sources next to template/, without installs or overwrites."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys

SKILL = Path(__file__).resolve().parents[1]
TEMPLATE = SKILL.parents[2]
WORKSPACE_SKILLS = ('make-marp-slides',)
FORBIDDEN = {'.git', '.claude', '.pi', '.env', 'sessions', 'logs', 'node_modules', 'build'}


def safe_path(base, relative):
    parts = PurePosixPath(relative).parts
    if not parts or PurePosixPath(relative).is_absolute() or any(
        part in ('.', '..') or part in FORBIDDEN or part.startswith('.env.') for part in parts
    ):
        raise ValueError(f'Unsafe resource path: {relative}')
    current = base
    if current.is_symlink():
        raise ValueError(f'Symbolic resource directory: {base}')
    for part in parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f'Symbolic path is not allowed: {relative}')
        if current != base.joinpath(*parts) and current.exists() and not current.is_dir():
            raise ValueError(f'Parent is not a directory: {relative}')
    return current


def planned_files():
    assets = SKILL / 'assets'
    manifest = json.loads(safe_path(assets, 'manifest.json').read_text())
    if manifest.get('version') != 1:
        raise ValueError('Unsupported bootstrap manifest version')
    files = {}
    for item in manifest['files']:
        relative, asset = item['path'], item['asset']
        if relative in files or not asset.startswith('workspace/'):
            raise ValueError(f'Invalid/duplicate manifest entry: {relative}')
        safe_path(TEMPLATE.parent, relative)
        source = safe_path(assets, asset)
        data = source.read_bytes()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise ValueError(f'Bootstrap checksum mismatch: {relative}')
        mode = item['mode']
        if mode not in (0o644, 0o755):
            raise ValueError(f'Invalid file mode: {relative}')
        files[relative] = (data, mode)
    # Only the everyday authoring skill is exposed outside template/.
    for name in WORKSPACE_SKILLS:
        source = safe_path(TEMPLATE, f'.agents/skills/{name}/SKILL.md').read_text()
        if not source.startswith('---\n') or '\n---\n' not in source:
            raise ValueError(f'Invalid skill frontmatter: {name}')
        frontmatter = source.split('\n---\n', 1)[0] + '\n---\n'
        content = frontmatter + (
            f'\nRead the [complete {name} skill](../../../template/.agents/skills/{name}/SKILL.md) '
            'before doing any work. Resolve its references from that canonical skill directory.\n'
        )
        relative = f'.agents/skills/{name}/SKILL.md'
        if relative in files:
            raise ValueError(f'Duplicate skill entry: {name}')
        files[relative] = (content.encode(), 0o644)
    return files


def initialize(check=False):
    invoked = Path(__file__).absolute()
    if any(path.is_symlink() for path in (invoked, *list(invoked.parents)[:5])):
        raise ValueError('Symbolic template/skill paths are not allowed')
    if TEMPLATE.name != 'template' or not safe_path(TEMPLATE, 'marp/theme.css').is_file() or not safe_path(TEMPLATE, 'latex/example.tex').is_file():
        raise ValueError('Place this repository at <dedicated-workspace>/template/ first; no automatic move is performed')
    root = TEMPLATE.parent
    files = planned_files()
    missing, conflicts = [], []
    # Complete the preflight before creating anything. Existing private trees are not scanned.
    for relative, (data, mode) in files.items():
        target = safe_path(root, relative)
        if target.exists():
            if not target.is_file() or target.read_bytes() != data or (mode == 0o755 and not target.stat().st_mode & 0o111):
                conflicts.append(relative)
        else:
            missing.append(relative)
    if conflicts:
        raise ValueError('Existing files differ; nothing written:\n  ' + '\n  '.join(conflicts))
    if not check:
        for relative in missing:
            target = safe_path(root, relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            data, mode = files[relative]
            # Exclusive create also refuses a file introduced after the preflight.
            with target.open('xb') as handle:
                handle.write(data)
            target.chmod(mode)
    verb = 'Would create' if check else 'Created'
    print(f'{verb} {len(missing)} files; kept {len(files) - len(missing)} identical files in {root}')
    if not check:
        print('Next (Marp): make install && make doctor TYPE=marp && make build-template TYPE=marp')
        print('Next (LaTeX): make doctor TYPE=latex && make build-template TYPE=latex')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='validate resources and destination without writing')
    options = parser.parse_args()
    try:
        initialize(options.check)
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f'Bootstrap error: {error}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
