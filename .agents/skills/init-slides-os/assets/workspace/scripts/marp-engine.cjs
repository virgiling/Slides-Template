// Official Marp functional engine: syntax extensions only; retain native Bespoke.
const { Marp } = require('@marp-team/marp-core');
const { script } = require('./presentation-keys.cjs');

const aliases = {
  summary: 'abstract', tldr: 'abstract', hint: 'tip', important: 'tip',
  check: 'success', done: 'success', help: 'question', faq: 'question',
  caution: 'warning', attention: 'warning', fail: 'failure', missing: 'failure',
  error: 'danger', cite: 'quote',
};

function callouts(md) {
  md.core.ruler.after('inline', 'obsidian_callouts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 3; i++) {
      if (tokens[i].type !== 'blockquote_open' || tokens[i + 1].type !== 'paragraph_open' ||
          tokens[i + 2].type !== 'inline' || tokens[i + 3].type !== 'paragraph_close') continue;
      const inline = tokens[i + 2];
      const marker = inline.content.match(/^\[!([a-z][\w-]*)\]([+-])?(?:[ \t]+([^\n]*))?(?:\n|$)/i);
      if (!marker) continue;
      const original = marker[1].toLowerCase();
      const type = Object.hasOwn(aliases, original) ? aliases[original] : original;
      tokens[i].attrJoin('class', type === 'aigc' ? 'callout aigc' : 'callout');
      tokens[i].attrSet('data-callout', type);
      // +/- are accepted but intentionally expanded for presentation/PDF parity.
      tokens[i + 1].tag = tokens[i + 3].tag = 'div';
      tokens[i + 1].attrJoin('class', 'callout-title');
      const body = inline.content.slice(marker[0].length);
      const title = marker[3]?.trim();
      inline.content = type === 'aigc'
        ? (title ? `AIGC · ${title}` : 'AIGC')
        : (title || type.charAt(0).toUpperCase() + type.slice(1));
      inline.children = [];
      state.md.inline.parse(inline.content, state.md, state.env, inline.children);
      if (body) {
        const open = new state.Token('paragraph_open', 'p', 1);
        const content = new state.Token('inline', '', 0);
        const close = new state.Token('paragraph_close', 'p', -1);
        open.level = close.level = tokens[i + 1].level;
        content.level = inline.level;
        content.content = body;
        content.children = [];
        state.md.inline.parse(body, state.md, state.env, content.children);
        tokens.splice(i + 4, 0, open, content, close);
      }
    }
  });

  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const language = tokens[index].info.trim().split(/\s+/)[0].slice(0, 32) || 'text';
    return fence(tokens, index, options, env, renderer)
      .replace(/<pre(?=[\s>])/, `<pre data-language="${md.utils.escapeHtml(language)}"`);
  };
}

module.exports = (options = {}) => {
  const marp = new Marp({
    ...options,
    html: false,
    math: { lib: 'katex', katexOption: { output: 'mathml', trust: false, throwOnError: true } },
  });
  marp.use(callouts);
  const render = marp.render.bind(marp);
  marp.render = (...args) => {
    const result = render(...args);
    return { ...result, html: `${result.html}\n<script data-slide-key-aliases>${script}</script>` };
  };
  return marp;
};
