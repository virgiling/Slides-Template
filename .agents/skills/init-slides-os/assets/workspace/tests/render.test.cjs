const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const createEngine = require('../scripts/marp-engine.cjs');
const { installPresentationKeys } = require('../scripts/presentation-keys.cjs');
const { copyAssets } = require('../scripts/copy-assets.cjs');

const root = path.resolve(__dirname, '..');
const example = path.join(root, 'template/marp');
const source = fs.readFileSync(path.join(example, 'example.md'), 'utf8');
const theme = fs.readFileSync(path.join(example, 'theme.css'), 'utf8');

function engine() {
  const marp = createEngine();
  marp.themeSet.add(theme);
  return marp;
}

test('theme, pagination, math and code render through the API', () => {
  const fixture = '---\ntheme: virgiling\nmath: katex\n---\n# Test\n\n$x^2$\n\n---\n\n```python\nprint(1)\n```';
  const rendered = engine().render(fixture);
  assert.equal(rendered.comments.length, 2);
  assert.match(rendered.html, /data-theme="virgiling"/);
  assert.ok(rendered.html.includes('<math '), 'native MathML must be emitted');
  assert.ok(!rendered.html.includes('katex-html'), 'do not use KaTeX HTML font metrics');
  assert.ok(rendered.html.includes('data-language="python"'));
  assert.ok(rendered.html.includes('hljs-number'));
  for (const font of ('Linux Biolinum|Cambria Math|MD IO').split('|')) assert.ok(theme.includes(font));
  assert.match(rendered.html, /language-python/);
  assert.match(rendered.css, /#015cad/i);
  assert.match(rendered.css, /#003865/i);
  assert.match(theme, /@theme virgiling/);
});

test('raw source HTML remains disabled without rejecting the Marp runtime', () => {
  const html = engine().render('<script>alert(1)</script>').html;
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('example compiles with the shared engine through the CLI, without a browser', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'marp-render-test-'));
  try {
    const output = path.join(temp, 'example.html');
    copyAssets(example, temp);
    const cli = path.join(root, 'node_modules/.bin/marp');
    const result = spawnSync(cli, ['--no-config-file', '--no-html', '--engine', path.join(root, 'scripts/marp-engine.cjs'), '--theme', 'theme.css', 'example.md', '--output', output], {
      cwd: example, encoding: 'utf8', timeout: 60000,
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    const html = fs.readFileSync(output, 'utf8');
    assert.ok(/<!doctype html>/i.test(html), 'CLI should emit an HTML document');
    assert.ok(/<button\b[^>]*data-bespoke-marp-osc="fullscreen"/.test(html), 'native fullscreen control must keep the preview bridge selector contract');
    for (const marker of ['preview-config', 'terminal-panel', 'preview-drawer', 'installSlideFullscreen', 'ttyd · fish', 'terminalOrigin', '__connect/']) {
      assert.ok(!html.includes(marker), `static export must not contain ${marker}`);
    }
    assert.ok(html.includes('class="callout aigc"'), 'AIGC frames must work in exported HTML');
    assert.ok(html.includes('<math ') && html.includes('data-slide-key-aliases'));
    assert.ok(fs.existsSync(path.join(temp, 'assets/aigc-badge.png')));
    // --theme <file> assigns an internal name; verify the public CSS contract.
    assert.ok(html.includes('#015cad') && html.includes('#003865'), 'custom theme palette should be embedded');
    assert.equal((html.match(/<section id="\d+"/g) || []).length, engine().render(source).comments.length);
    for (const match of source.matchAll(/!\[[^\]]*\]\((assets\/[^)\s]+)\)/g)) {
      assert.ok(fs.existsSync(path.join(temp, match[1])), `missing output asset: ${match[1]}`);
      assert.ok(html.includes(match[1]), `missing rendered image: ${match[1]}`);
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('make-marp-slides skill example compiles as fragments with mixed provenance', () => {
  const skill = fs.readFileSync(path.join(root, 'template/.agents/skills/make-marp-slides/SKILL.md'), 'utf8');
  const fragment = skill.match(/```markdown\n([\s\S]*?)\n```/)[1];
  assert.ok(!fragment.includes('marp:') && !fragment.includes('footer:'));
  const result = engine().render('---\ntheme: virgiling\nmath: katex\n---\n' + fragment);
  assert.equal(result.comments.length, 2);
  assert.equal((result.html.match(/class="callout aigc"/g) || []).length, 2);
  assert.match(result.html, /<section id="2"[^>]*>\s*<h1\b[^>]*>用户原有的标题<\/h1>/, 'preserve the human heading outside added content');
  assert.ok(!result.html.includes('[!aigc]'));
});

test('Obsidian callouts preserve titles, consecutive body lines, nesting, aliases and code', () => {
  const source = '> [!AIGC] **Draft**\n> Body $x^2$\n>\n> > [!caution]- Read this\n> > Risk\n>\n> ```js\n> const answer = 42;\n> ```\n\n> [!mystery]\n\n> Ordinary quotation';
  const html = engine().render(source).html.split('<script')[0];
  for (const expected of ['class="callout aigc"', 'AIGC · <strong>Draft</strong>', '<p>Body ', '<math ',
    'data-callout="warning"', 'Read this', '<p>Risk</p>', 'data-language="js"', 'hljs-keyword',
    'data-callout="mystery"', 'Mystery', '<blockquote>\n<p>Ordinary quotation']) assert.ok(html.includes(expected), expected);
  assert.ok(!html.includes('[!') && !html.includes('<details'), 'markers consumed; print content stays expanded');
});

test('callout markers inside code are literal; unsafe titles/language labels stay escaped', () => {
  const html = engine().render('> [!note] <script>alert(1)</script>\n> <img src=x onerror=alert(2)>\n\n```text\n> [!aigc]\n```\n\n```x"onclick="bad\nx\n```').html.split('<script data-slide-key-aliases>')[0];
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<img src=x') && !html.includes('<script>alert(1)'));
  assert.ok(html.includes('[!aigc]') && !html.includes('class="callout aigc"'));
  assert.ok(!html.includes('data-language="x"onclick='));
});

test('AI example content is framed on every slide; footer and pagination stay outside', () => {
  const html = engine().render(source).html;
  const sections = [...html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length, 9);
  for (const [, attrs, body] of sections) {
    assert.ok(body.trimStart().startsWith('<blockquote class="callout aigc"'), 'each AI-authored slide starts with its AIGC frame');
    assert.ok(body.includes('</blockquote>\n<footer>Your Name · Group Seminar</footer>'));
    if (attrs.includes('data-marpit-pagination=')) assert.ok(attrs.includes('data-marpit-pagination-total="9"'));
  }
  assert.ok(!sections[0][1].includes('data-marpit-pagination='));
  assert.ok(theme.includes('linear-gradient') && theme.includes('data-marpit-pagination-total'));
});

test('compiled theme overrides the default clearfix for the footer band and lays out image columns', () => {
  const { html, css } = engine().render(source);
  const rules = [];
  require('postcss').parse(css).walkRules((rule) => rules.push(rule));
  function declarations(selector) {
    const values = {};
    for (const rule of rules) {
      if (rule.selector.split(',').some(s => s.trim().replace(/:{1,2}(before|after)/g, '::$1') === selector)) {
        rule.walkDecls(d => { values[d.prop] = d.value; });
      }
    }
    return values;
  }
  const section = 'div.marpit > svg > foreignObject > section';
  const band = declarations(section + '::before');
  assert.equal(band.display, 'block', 'empty table clearfix must not shrink the band to zero width');
  assert.equal(band.width, '100%');
  assert.equal(band.bottom, '0');
  assert.equal(declarations(section).border, '0', 'no top band');
  assert.equal(declarations(section + '::after').padding, '0');
  const imageSlide = html.match(/<section\b[^>]*class="image-split"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(imageSlide?.includes('assets/workflow.svg'));
  assert.ok(imageSlide?.includes('class="callout aigc"'));
  assert.ok(css.includes('grid-template-columns:minmax(0, 1fr) minmax(0, 1fr)'));
});

test('Marp fragments share a numbered page; two dashes are not a vertical separator', () => {
  const result = engine().render('---\ntheme: virgiling\npaginate: true\n---\n> [!aigc]\n> # Steps\n>\n> * First\n> * Second\n\n---\n\n# Next page');
  assert.equal(result.comments.length, 2);
  assert.ok(result.html.includes('data-marpit-fragments="2"'));
  assert.equal((result.html.match(/data-marpit-fragment="/g) || []).length, 2);
  assert.ok(result.html.includes('data-marpit-pagination-total="2"'));
  assert.equal(engine().render('# One\n\n--\n\n# Still one').comments.length, 1);
  assert.ok(engine().render(source).html.includes('data-marpit-fragments="2"'), 'example must actually demonstrate steps');
});

test('Vim-style aliases delegate to native keys and leave editing/modifiers alone', () => {
  let handler;
  let clock = 1000;
  const emitted = [];
  const document = {
    addEventListener: (type, callback) => { assert.equal(type, 'keydown'); handler = callback; },
    dispatchEvent: (event) => emitted.push(event.key),
  };
  class KeyboardEvent { constructor(_type, properties) { Object.assign(this, properties); } }
  installPresentationKeys(document, KeyboardEvent, () => clock);
  function press(key, extra = {}) { handler({ key, preventDefault() {}, ...extra }); }
  for (const key of ['h', 'j', 'k', 'l', 'G', 'g', 'g']) press(key);
  assert.deepEqual(emitted, ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'End', 'Home']);
  emitted.length = 0;
  for (const extra of [{ctrlKey: true}, {metaKey: true}, {altKey: true}, {isComposing: true},
    {defaultPrevented: true}, {target: {isContentEditable: true}}, {target: {closest: () => ({})}}]) press('j', extra);
  press('g'); clock += 700; press('g'); press('x'); press('g'); press('g', {repeat: true});
  press('constructor'); press('ArrowRight');
  assert.deepEqual(emitted, []);
});

test('asset packaging excludes hidden/private files and removes stale assets', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'marp-assets-test-'));
  try {
    const assets = path.join(temp, 'assets');
    fs.mkdirSync(path.join(assets, '.private'), { recursive: true });
    fs.writeFileSync(path.join(assets, 'visible.svg'), '<svg/>');
    fs.writeFileSync(path.join(assets, '.private/hidden.svg'), 'synthetic sentinel');
    fs.writeFileSync(path.join(assets, 'private.db'), 'synthetic sentinel');
    const output = path.join(temp, 'build');
    copyAssets(temp, output);
    assert.deepEqual(fs.readdirSync(path.join(output, 'assets')), ['visible.svg']);
    fs.unlinkSync(path.join(assets, 'visible.svg'));
    copyAssets(temp, output);
    assert.ok(!fs.existsSync(path.join(output, 'assets/visible.svg')));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
