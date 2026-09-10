#!/usr/bin/env python3
"""Run native Marp server mode on public source copies, never on private project state."""

import argparse
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import tempfile
import time

PUBLIC_ASSETS = {".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".pdf", ".mp4", ".webm"}


def source_files(project: Path, entry: str) -> list[Path]:
    files = [project / entry, project / "theme.css"]
    assets = project / "assets"
    if assets.is_symlink():
        raise ValueError("Do not serve a symbolic assets directory")
    if assets.is_dir():
        for directory, folders, names in os.walk(assets, followlinks=False):
            folders[:] = [name for name in folders if not name.startswith('.') and not (Path(directory) / name).is_symlink()]
            for name in names:
                file = Path(directory) / name
                if not name.startswith('.') and file.suffix.lower() in PUBLIC_ASSETS:
                    files.append(file)
    for file in files:
        if file.is_symlink() or not file.is_file():
            raise ValueError(f"Missing or symbolic public source: {file}")
    return files


def sync(project: Path, entry: str, target: Path, previous: dict) -> dict:
    current = {}
    for file in source_files(project, entry):
        relative = file.relative_to(project)
        metadata = file.stat()
        stamp = (metadata.st_mtime_ns, metadata.st_size)
        current[relative] = stamp
        if previous.get(relative) != stamp:
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            pending = destination.with_name('.' + destination.name + '.tmp')
            shutil.copy2(file, pending)
            pending.replace(destination)
    for removed in previous.keys() - current.keys():
        (target / removed).unlink(missing_ok=True)
    return current


def stop(_signum, _frame):
    raise KeyboardInterrupt


def wait_for_marp(process, port):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise SystemExit(process.returncode or 1)
        try:
            with socket.create_connection(('127.0.0.1', port), timeout=0.25):
                return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError('Native Marp server did not become ready')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('entry', choices=('slides.md', 'example.md'))
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--session', default='')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    node = shutil.which('node')
    if not node:
        parser.error('Node.js is required')
    cli = Path(__file__).resolve().parents[1] / 'node_modules/.bin/marp'
    if not cli.is_file():
        parser.error('Marp is not installed; run make install first')
    if args.project.is_symlink():
        parser.error('project may not be symbolic')
    project = args.project.resolve()
    signal.signal(signal.SIGTERM, stop)
    with tempfile.TemporaryDirectory(prefix='slides-marp-serve-') as temporary:
        target = Path(temporary)
        state = sync(project, args.entry, target, {})
        while True:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                marp_port = sock.getsockname()[1]
            if marp_port != args.port:
                break
        env = {**os.environ, 'PORT': str(marp_port)}
        scripts = Path(__file__).resolve().parent
        command = [node, '--require', str(scripts / 'marp-loopback.cjs'), str(cli),
                   '--server', '--watch', '--no-config-file', '--no-html',
                   '--engine', str(scripts / 'marp-engine.cjs'), '--theme', str(target / 'theme.css'), str(target)]
        processes = []
        try:
            processes.append(subprocess.Popen(command, cwd=target, env=env, start_new_session=True))
            # Never offer a shell whose first iframe load races Marp startup.
            wait_for_marp(processes[0], marp_port)
            processes.append(subprocess.Popen(
                [node, str(scripts / 'preview-proxy.cjs'), '--port', str(args.port),
                 '--marp-port', str(marp_port), '--session', args.session, '--entry', args.entry,
                 '--cwd', str(scripts.parent if args.entry == 'example.md' else project)],
                cwd=target, env=env, start_new_session=True))
            print('Native Marp + one-click ttyd drawer; public slide/theme/assets only. Ctrl-C stops preview.', flush=True)
            while all(process.poll() is None for process in processes):
                time.sleep(0.25)
                state = sync(project, args.entry, target, state)
            for process in processes:
                if process.poll() not in (None, 0):
                    raise SystemExit(process.returncode)
        except KeyboardInterrupt:
            pass
        finally:
            for process in processes:
                if process.poll() is None:
                    try:
                        os.killpg(process.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
            for process in processes:
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()


if __name__ == '__main__':
    main()
