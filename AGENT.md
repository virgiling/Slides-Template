# Template Repository Instructions

## Routing

This is an independent template Git repository, not a collection of talks.

- `latex/`: formal Beamer/PDF slides. Read `latex/AGENT.md` and `latex/README.md` before using or changing it.
- `marp/`: a reusable CSS theme plus a Markdown example for informal talks. Read `marp/AGENT.md` and `marp/README.md` before using or changing it.
- Read `README.md` to choose a template. Do not force Markdown-to-LaTeX conversion or change a talk's format without asking.
- The surrounding `../scripts/slides` and `../Makefile`, when present, manage talk copies. They are outside this repository; preserve that boundary.

## Shared rules

- Keep the only template `.gitignore` here at the repository root. It covers both subdirectories. Keep `LICENSE.txt` here too.
- Each template README must show a local thumbnail and runnable commands. Keep the root routing table and previews synchronized.
- `thumbnail.png` must show the actual compiled cover. Never replace it with a drawn illustration. Use the outer workspace's `make thumbnails`, or native PDF/Marp first-page export.
- This repository must not contain `scripts/`, Node dependencies, tests or per-talk application scaffolds. Shared tooling belongs to the outer slides workspace.
- Runtime artifacts belong in ignored `build/`; checked-in cover PNGs are the intentional documentation exception.
- Never read or copy sessions, `.claude/`, `.pi/`, private logs, databases, credentials, or environment files. Copy only explicit source-file allowlists into new talks, not entire directories.
- Do not read private build outputs from unrelated projects. Logs created by the current compile may be checked for errors.

## Verification policy

- Do not invoke visual models by default.
- Do not use any browser tools. Test functionality through APIs, CLI commands, and compilation.
- Treat visual appearance beyond compilation as acceptable by default; a human will request visual fixes if needed. Do not open preview windows as a verification step.
- Marp HTML rendering and API tests need no browser. Native PDF/PNG export may use Marp CLI's isolated browser compiler, but never a user browser profile or visual inspection. Temporary server tests use HTTP and must shut down/clean up afterward.
- Run the narrow check for the changed template and check local Markdown/image links. Do not install global dependencies or change unrelated talks.

## Git discipline

- Implement and verify in small coherent steps. Before delivery, squash only this task's unpublished changes into one final commit per independent repository. Use an English, single-line commit message.
- Keep history linear. Fetch the configured upstream before synchronizing; if it has new commits, rebase local work onto it rather than creating a merge commit. Stop on conflicts requiring a decision.
- Never commit ignored artifacts or sensitive state. Stage explicit source/docs paths, not whole workspace trees.
- Do not push, force-push, or rewrite already published history without explicit permission.
