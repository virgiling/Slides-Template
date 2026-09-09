# AGENT.md

## Scope

Read `../AGENT.md` first. Maintain the reusable Beamer class, its self-contained example, and the Zed build task in this directory. This is the formal PDF track; use `../marp/` for Markdown-first informal talks.

For a new talk, use the outer workspace's `make new NAME=<name> TYPE=latex` when available. Otherwise copy only `example.tex` (as `main.tex`), `virgiling-slides.cls`, `references.bib`, and the root `../.gitignore` and `../LICENSE.txt` into a fresh talk directory. Customize metadata and frames there; never overwrite the reusable example with a personal talk.

## Source files

- `virgiling-slides.cls`: template implementation and public commands.
- `example.tex`: neutral, compilable feature reference.
- `references.bib`: compact example bibliography used by `example.tex`.
- `.zed/tasks.json`: supported editor build workflow.
- `README.md`: usage documentation with `thumbnail.png`, the actual compiled cover. Regenerate via outer `make thumbnails TYPE=latex` or PDF first-page export; never draw a substitute.
- `build/`: ignored generated output; never treat it as source.
- `../.gitignore`: shared ignore rules. Do not add a child `.gitignore`.

## Invariants

- Keep the class name `virgiling-slides`.
- Keep the structural palette anchored to `VirgilingBlue` (`#015CAD`) and `VirgilingCyan` (`#003865`).
- Use Linux Biolinum for text, Cambria Math for mathematics, and MD IO for monospaced content.
- Resolve Linux Biolinum, Cambria Math, and MD IO from installed system fonts. Do not add font copies, downloads, symlinks, or setup scripts.
- Keep title-page navigation empty.
- Keep the main top-navigation band black; reserve `VirgilingCyan` for the footer family.
- On content frames, show section names and progress dots in the upper bar; keep the lower bar free of subsection text.
- Keep visible spacing between adjacent progress dots; the mini-frame advance must exceed the rendered dot diameter.
- Keep all three footer cells in the same slightly darkened `VirgilingCyan` and preserve comfortable padding at the outer edges.
- Keep unordered and ordered list markers square.
- Keep the default `listings` style compatible with MD IO and the existing Beamer palette.
- Keep BibLaTeX citations bracketed and alphabetic, using shortened author labels plus two-digit years, with `+` for larger author lists.
- Keep bibliography text black except for conference names, which are gray and italic.
- Keep the example independent of files outside this repository and generated source files.
- Keep comments concise. Retain only non-obvious constraints or optional usage examples.
- Put runtime output under `build/`; do not restore root-level PDFs, logs, SyncTeX files, or auxiliaries. The checked-in actual cover `thumbnail.png` is the intentional documentation exception.
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

- Confirm `build/example.pdf` exists and is a readable PDF via `pdfinfo` or `pdftotext`; do not open a viewer for verification.
- Do not call browser tools or visual models. Use compilation, CLI/API tests, and text checks; visual appearance is accepted unless a human reports a problem.
- Implement and verify in small steps; before delivery squash this task's unpublished changes into one final commit per independent repository with an English, single-line message. Keep linear history and rebase when upstream has new commits.
- Check `build/example.log` for LaTeX errors, missing characters, and overfull boxes.
- Confirm citations in the final PDF and confirm the bibliography is generated under `build/`; Tectonic's kept log may retain BibLaTeX's first-pass rerun notice when using the BibTeX backend.
- Confirm Cambria Math and MD IO remain embedded in the PDF after typography changes.
- Confirm the template source directory contains no generated LaTeX files.
