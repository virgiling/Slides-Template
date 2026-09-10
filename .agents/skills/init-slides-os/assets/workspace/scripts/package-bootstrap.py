#!/usr/bin/env python3
"""Refresh/check the explicit public-source bootstrap snapshot; never traverse private state."""

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'template/.agents/skills/init-slides-os/assets'
# One reviewed allowlist: no whole-workspace copies, dependencies, fonts, talks or build outputs.
FILES = (
    '.gitignore', '.zed/tasks.json', 'AGENT.md', 'README.md', 'Makefile', 'package.json', 'bun.lock',
    'scripts/slides', 'scripts/copy-assets.cjs', 'scripts/marp-engine.cjs',
    'scripts/presentation-keys.cjs', 'scripts/marp-loopback.cjs', 'scripts/serve-marp.py',
    'scripts/preview-proxy.cjs', 'scripts/preview.html', 'scripts/preview-drawer.mjs',
    'scripts/preview-drawer.css', 'scripts/terminal-backend.cjs', 'scripts/terminal-layout.kdl',
    'scripts/thumbnails.py', 'scripts/package-bootstrap.py',
    'tests/render.test.cjs', 'tests/preview.test.cjs', 'tests/ttyd.test.cjs',
    'tests/test_slides.py', 'tests/test_marp_server.py', 'tests/test_marp_layout.py',
    'tests/test_bootstrap.py',
)


def asset_name(relative):
    names = {'.gitignore': 'gitignore', 'AGENT.md': 'AGENT.md.in', 'README.md': 'README.md.in'}
    return 'workspace/' + names.get(relative, relative)


def checked(base, relative):
    current = base
    if current.is_symlink():
        raise ValueError(f'Symbolic resource directory: {base}')
    for part in Path(relative).parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f'Symbolic resource path: {relative}')
    return current


def package(check=False):
    checked(ROOT, ASSETS.relative_to(ROOT))
    planned, entries = {}, []
    for relative in FILES:
        source = checked(ROOT, relative)
        data = source.read_bytes()
        mode = 0o755 if source.stat().st_mode & 0o111 else 0o644
        # Avoid a second .gitignore inside the template repository.
        asset = asset_name(relative)
        entries.append({'path': relative, 'asset': asset, 'sha256': hashlib.sha256(data).hexdigest(), 'mode': mode})
        planned[asset] = data
    planned['manifest.json'] = (json.dumps({'version': 1, 'files': entries}, indent=2) + '\n').encode()
    stale = []
    for relative, data in planned.items():
        target = checked(ASSETS, relative)
        if not target.is_file() or target.read_bytes() != data:
            stale.append(relative)
    if check and stale:
        raise ValueError('Bootstrap snapshot is stale; run python3 scripts/package-bootstrap.py:\n  ' + '\n  '.join(stale))
    if not check:
        for relative in stale:
            target = checked(ASSETS, relative)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(planned[relative])
    print(f'Bootstrap snapshot {"checked" if check else "updated"}: {len(entries)} public source files')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='fail if the snapshot differs from the workspace')
    args = parser.parse_args()
    try:
        package(args.check)
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
