#!/usr/bin/env python3
"""Render real cover thumbnails via compilers, without visual-model inspection."""

import argparse
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile

WORKSPACE = Path(__file__).resolve().parents[1]
ROOT = WORKSPACE / "template"
WIDTH = 960


def run(args: list[str], cwd: Path, temporary: Path) -> None:
    env = {**os.environ, "TMPDIR": str(temporary)}
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=180)
    if result.returncode:
        raise RuntimeError(f"Command failed: {args[0]}\n{result.stdout}\n{result.stderr}")


def png_size(file: Path) -> tuple[int, int]:
    with file.open("rb") as stream:
        header = stream.read(24)
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"Not a PNG image: {file}")
    return struct.unpack(">II", header[16:24])


def copy_sources(kind: str, names: tuple[str, ...], work: Path) -> None:
    for name in names:
        source = ROOT / kind / name
        # Explicit source files only; no sessions, logs, build outputs or profiles.
        if source.is_symlink() or any(parent.is_symlink() for parent in source.parents):
            raise ValueError(f"Refusing symbolic source: {source}")
        target = work / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def render(kind: str) -> None:
    with tempfile.TemporaryDirectory(prefix=f"slides-{kind}-cover-") as temporary:
        work = Path(temporary)
        output = work / "thumbnail.png"
        if kind == "latex":
            copy_sources(kind, ("example.tex", "virgiling-slides.cls", "references.bib"), work)
            (work / "build").mkdir()
            run(["tectonic", "-X", "compile", "example.tex", "--outdir", "build"], work, work)
            run(["pdftoppm", "-f", "1", "-singlefile", "-png", "-scale-to-x", str(WIDTH),
                 "-scale-to-y", "540", "build/example.pdf", "thumbnail"], work, work)
        else:
            cli = WORKSPACE / "node_modules/.bin/marp"
            if not cli.is_file():
                raise RuntimeError("Install shared Marp tooling first: make install")
            copy_sources(kind, ("example.md", "theme.css", "assets/workflow.svg", "assets/aigc-badge.png"), work)
            # Marp's native image compiler creates an isolated browser profile.
            # No user browser profile or browser automation tool is used here.
            run([str(cli), "example.md", "--no-config-file", "--engine", str(WORKSPACE / "scripts/marp-engine.cjs"),
                 "--theme", "theme.css", "--no-html", "--image", "png", "--image-scale", "0.75",
                 "--allow-local-files", "--output", str(output)], work, work)
        size = png_size(output)
        if size != (WIDTH, 540):
            raise ValueError(f"Unexpected 16:9 thumbnail dimensions: {size}")
        shutil.copyfile(output, ROOT / kind / "thumbnail.png")
        print(f"Rendered {kind}/thumbnail.png ({size[0]} x {size[1]}) from the actual cover")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("type", choices=("latex", "marp", "all"), nargs="?", default="all")
    selected = parser.parse_args().type
    for kind in (("latex", "marp") if selected == "all" else (selected,)):
        render(kind)


if __name__ == "__main__":
    main()
