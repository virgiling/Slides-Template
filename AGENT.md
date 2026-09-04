# AGENT.md

## Scope

Maintain the reusable Beamer class, its self-contained example, and the Zed build task in this directory.

## Source files

- `virgiling-slides.cls`: template implementation and public commands.
- `example.tex`: neutral, compilable feature reference.
- `.zed/tasks.json`: supported editor build workflow.
- `README.md`: user-facing usage documentation.
- `build/`: ignored generated output; never treat it as source.

## Invariants

- Keep the class name `virgiling-slides`.
- Preserve the existing Orchid and Whale color themes unless the user requests a palette change.
- Use Linux Biolinum for text, Cambria Math for mathematics, and MD IO for monospaced content.
- Resolve Cambria Math and MD IO from installed system fonts. Do not add font copies, symlinks, or setup scripts.
- Keep title-page navigation empty.
- On content frames, show section names and progress dots in the upper bar; keep the lower bar free of subsection text.
- Keep unordered and ordered list markers square.
- Keep the example independent of external images, bibliography databases, and generated source files.
- Keep comments concise. Retain only non-obvious constraints or optional usage examples.
- Put every generated file under `build/`; do not restore root-level PDFs, logs, SyncTeX files, or auxiliaries.
- Document only the Zed workflow unless the user explicitly requests another editor setup.

## Editing discipline

- Preserve ordinary Beamer class-option forwarding.
- Do not edit files under `build/` by hand.
- Keep public commands backward compatible:
  - `\VirgilingTitleFrame`
  - `\VirgilingOutlineFrame`
  - `\VirgilingEnableSectionOutlines`
  - `\VirgilingFooterLeft`
  - `\VirgilingFooterCenter`
  - `\VirgilingFooterRight`
- Keep `example.tex` generic and ensure each frame demonstrates one reusable pattern.
- Update `README.md` when commands, dependencies, or build behavior change.

## Verification

Run from this directory:

```bash
mkdir -p build
tectonic -X compile example.tex \
  --outdir build \
  --keep-logs \
  --keep-intermediates \
  --synctex
```

Before completing a change:

- Confirm `build/example.pdf` exists and opens.
- Check `build/example.log` for LaTeX errors, missing characters, undefined references, and overfull boxes.
- Confirm Cambria Math and MD IO remain embedded in the PDF after typography changes.
- Confirm the template source directory contains no generated LaTeX files.
