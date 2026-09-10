# Template Repository Instructions

## Routing

This is an independent template Git repository, not a collection of talks.

- `latex/`: formal Beamer/PDF slides. Read `latex/AGENT.md` and `latex/README.md` before using or changing it.
- `marp/`: a reusable CSS theme plus a Markdown example for informal talks. Read `marp/AGENT.md` and `marp/README.md` before using or changing it.
- Read `README.md` to choose a template. Do not force Markdown-to-LaTeX conversion or change a talk's format without asking.
- Initialize a standalone clone at <workspace>/template with .agents/skills/init-slides-os/scripts/init_workspace.py. Its reviewed source resources create the surrounding ../scripts/slides and ../Makefile without overwrites, installs or Git operations. Preserve this runtime boundary.
- docs/ contains only operational guides: setup, customization and terminal use. .agents/skills/ contains init-slides-os and make-marp-slides in standard <name>/SKILL.md directories. Keep historical investigations/test diaries out of user guides.

## Shared rules

- Keep the only template `.gitignore` here at the repository root. It covers both subdirectories. Keep `LICENSE.txt` here too.
- Each template README must show a local thumbnail and runnable commands. Keep the root routing table and previews synchronized.
- `thumbnail.png` must show the actual compiled cover. Never replace it with a drawn illustration. Use the outer workspace's `make thumbnails`, or native PDF/Marp first-page export.
- No runtime scripts/, node_modules, tests or application scaffolds in the format directories or repository root. The explicit exception is the init-slides-os skill's scripts/ and reviewed assets/ source snapshot, needed to bootstrap a clone without a private companion repo. Keep installed dependencies and runtime tools in the outer workspace. Refresh assets from outer maintenance sources with python3 scripts/package-bootstrap.py; do not hand-edit generated resource copies.
- The Marp example uses the outer official functional-engine extension for callouts, native MathML and key aliases. Explain that vanilla Marp only renders base CSS, while the included bootstrap supplies all tools for the enhanced example. All AI-generated Marp slide content must be framed in `> [!aigc]` / `.callout.aigc`; see marp/AGENT.md. The third-party badge is not covered by the MIT license.
- Runtime artifacts belong in ignored `build/`; checked-in cover PNGs are the intentional documentation exception.
- Never read or copy sessions, `.claude/`, `.pi/`, private logs, databases, credentials, or environment files. Copy only explicit source-file allowlists into new talks, not entire directories.
- Do not read private build outputs from unrelated projects. Logs created by the current compile may be checked for errors.

## Verification policy

- Do not invoke visual models by default.
- Do not use any browser tools. Test functionality through APIs, CLI commands, and compilation.
- Treat visual appearance beyond compilation as acceptable by default; a human will request visual fixes if needed. Do not open preview windows as a verification step.
- Marp HTML rendering and API tests need no browser. Native PDF/PNG export may use Marp CLI's isolated browser compiler, but never a user browser profile or visual inspection. Temporary server tests use HTTP and must shut down/clean up afterward.
- Validate skill frontmatter, links and the template-only bootstrap path when changing onboarding. Run outer make test / bun run check; SLIDES_TEST_BOOTSTRAP=1 make test additionally installs pinned dependencies and builds the full example in a fresh temporary workspace. No user sessions/configuration may enter fixtures.
- Run the narrow check for the changed template and check local Markdown/image links. Do not install global dependencies or change unrelated talks.

## Git discipline

- Implement and verify in small coherent steps. Before delivery, squash only this task's unpublished changes into one final commit per independent repository. Use an English, single-line commit message.
- If the user asks to confirm visuals before committing, leave all changes uncommitted until approval; tests do not replace human approval.
- Keep history linear. Fetch the configured upstream before synchronizing; if it has new commits, rebase local work onto it rather than creating a merge commit. Stop on conflicts requiring a decision.
- Never commit ignored artifacts or sensitive state. Stage explicit source/docs paths, not whole workspace trees.
- Do not push, force-push, or rewrite already published history without explicit permission.
