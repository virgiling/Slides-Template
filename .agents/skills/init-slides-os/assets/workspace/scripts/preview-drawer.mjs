// Preview-only UI. Marp and ttyd keep their own keyboards; no terminal input is generated here.
export function drawerController({ mount, unmount, visibility, focusSlides }) {
  let opened = false;
  return {
    get opened() { return opened; },
    open() {
      if (opened) return;
      visibility(true);
      mount();
      opened = true;
    },
    close() {
      if (!opened) return;
      unmount(); // Detach the ttyd client, never terminate the persistent shell/session.
      opened = false;
      visibility(false);
      focusSlides();
    },
  };
}

// Marp's native fullscreen target is the iframe's body, which excludes the drawer.
// Route only its fullscreen gestures to the outer root, synchronously while the
// user activation is available. Do not patch browser APIs or ttyd's keyboard.
export function installSlideFullscreen(document, slideDocument) {
  const root = document.documentElement;
  const request = root?.requestFullscreen || root?.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!slideDocument || !request || !exit || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) return () => {};
  const selector = '[data-bespoke-marp-osc="fullscreen"]';
  const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const sync = () => {
    for (const button of slideDocument.querySelectorAll(selector)) {
      button.classList.toggle('exit', active());
      button.setAttribute('aria-pressed', String(active()));
    }
  };
  const toggle = event => {
    event.preventDefault();
    event.stopImmediatePropagation(); // Prevent Marp from also fullscreening the inner body.
    try {
      const result = active() ? exit.call(document) : request.call(root);
      Promise.resolve(result).catch(error => { sync(); console.warn('Preview fullscreen failed:', error); });
    } catch (error) { sync(); console.warn('Preview fullscreen failed:', error); }
  };
  const click = event => {
    const button = event.target?.closest?.(selector);
    if (button) { button.blur(); toggle(event); }
  };
  const keydown = event => {
    if (!['f', 'F11'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (event.isComposing || event.keyCode === 229 || event.defaultPrevented || target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO'].includes(target?.tagName)) {
      event.stopImmediatePropagation(); // Ignore fullscreen without preventing typing/composition.
      return;
    }
    toggle(event);
  };
  slideDocument.addEventListener('click', click, true);
  slideDocument.addEventListener('keydown', keydown, true);
  for (const event of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(event, sync);
  sync();
  return () => {
    slideDocument.removeEventListener('click', click, true);
    slideDocument.removeEventListener('keydown', keydown, true);
    for (const event of ['fullscreenchange', 'webkitfullscreenchange']) document.removeEventListener(event, sync);
  };
}

export function installPreview(document, window) {
  const config = JSON.parse(document.getElementById('preview-config').textContent);
  const get = id => document.getElementById(id);
  const slides = get('slide-frame');
  const panel = get('terminal-panel');
  const toggle = get('terminal-toggle');
  const container = get('terminal-container');
  const drawer = drawerController({
    mount() {
      const frame = document.createElement('iframe');
      frame.title = 'ttyd · fish';
      frame.allow = 'clipboard-read; clipboard-write; fullscreen';
      frame.referrerPolicy = 'no-referrer';
      frame.src = config.terminalURL;
      frame.addEventListener('load', () => { if (drawer.opened) frame.contentWindow?.focus(); });
      container.append(frame);
    },
    unmount() { container.replaceChildren(); },
    visibility(opened) {
      panel.hidden = !opened;
      toggle.hidden = opened;
      toggle.setAttribute('aria-expanded', String(opened));
    },
    focusSlides() { slides.contentWindow?.focus(); },
  });
  toggle.addEventListener('click', () => drawer.open());
  get('terminal-close').addEventListener('click', () => drawer.close());
  // Keep bookmark/back-forward semantics. Only the slide iframe reloads on Markdown edits.
  let releaseFullscreen = () => {};
  slides.addEventListener('load', () => {
    releaseFullscreen();
    releaseFullscreen = installSlideFullscreen(document, slides.contentDocument);
    const slideWindow = slides.contentWindow;
    const syncHash = () => {
      if (window.location.hash !== slideWindow.location.hash) window.history.replaceState(null, '',
        window.location.pathname + window.location.search + slideWindow.location.hash);
    };
    slideWindow.addEventListener('hashchange', syncHash);
    syncHash();
    if (!drawer.opened) slideWindow.focus();
  });
  window.addEventListener('hashchange', () => {
    if (slides.contentWindow.location.hash !== window.location.hash) slides.contentWindow.location.hash = window.location.hash;
  });
  slides.src = `/__slides__/${config.entry}${window.location.search}${window.location.hash}`;
  return drawer;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installPreview(document, window);
