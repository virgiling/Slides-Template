# Marp Theme Instructions

Read `../AGENT.md` and this directory's `README.md` first. These rules apply to all future work in this directory.

## What is reusable

- `theme.css` is the reusable CSS theme, named `virgiling`. `example.md` only demonstrates native Marp usage.
- Keep blue `#015CAD`, cyan `#003865`, system font fallbacks, white background, and a 16:9 example.
- Use required `/* @theme virgiling */` metadata and inherit Marp's built-in default theme through `@import 'default'`.
- Style slide `section` elements; use Markdown directives (`class`, `paginate`, `footer`) for page-specific choices.
- Do not confuse CSS theme with CLI `--template`, which chooses the built-in HTML presenter (`bespoke` or `bare`). Do not build a custom player or converter.
- Keep dependencies, tests, build/server/thumbnail scripts outside this template repository, in the surrounding slides workspace. Do not add package.json, lockfiles, node_modules, or helper scripts to this theme.
- New talks need only the theme, Markdown and public assets plus shared LICENSE/.gitignore and their AGENT.md; do not turn them into Node projects.
- `thumbnail.png` must be the actual rendered cover, never a hand-drawn illustration. Regenerate it via outer `make thumbnails TYPE=marp`, or native `marp --theme theme.css example.md --image png --image-scale 0.75 -o thumbnail.png`.

## Usage

In the outer workspace: `make install` once, `make new NAME=<name> TYPE=marp`, then `make serve SLIDE=<name>` for a live HTTP preview or `make build SLIDE=<name>` for HTML export. `make serve` with no name previews this theme example.

Standalone: install Marp CLI separately and run `marp --theme theme.css <talk.md>`. Native `marp --server --watch <dir>` serves that directory, so only use a public presentation directory. The outer server wrapper mirrors only public sources to avoid exposing private project state.

## Permanent rules

- Do not invoke visual models by default. Do not use browser tools.
- Verify functionality using APIs, CLI, HTTP, and compilation. Accept appearance unless a human reports a problem. No automated viewer-based inspection.
- Native PDF/PNG export may use Marp's isolated browser compiler; that is compilation, not visual inspection. Never use a user browser profile.
- HTTP tests may start a temporary server but must stop it and clean up afterward.
- Implement and verify in small steps; before delivery squash this task's unpublished work into one final commit per independent repository. Use an English, single-line commit message.
- Keep linear history: fetch upstream and rebase when the remote has new commits. Never push or rewrite published history without permission.
- Do not read or copy sessions, private logs, databases, secrets, .env, .claude/, or .pi/. Use explicit source allowlists.
- Keep the only template .gitignore at the repository root. Keep generated previews in build/; tracked thumbnail.png is the intentional documentation exception.
