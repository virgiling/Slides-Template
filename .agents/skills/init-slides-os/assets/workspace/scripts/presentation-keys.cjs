// Small aliases over Bespoke's native keyboard navigation, not a second player.
function installPresentationKeys(document, KeyboardEvent, now = Date.now) {
  let lastG = null;
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        target?.isContentEditable || target?.closest?.('input, textarea, select, button, [role="textbox"]')) {
      lastG = null;
      return;
    }
    const navigation = { h: 'ArrowLeft', j: 'ArrowDown', k: 'ArrowUp', l: 'ArrowRight', G: 'End' };
    let key = Object.hasOwn(navigation, event.key) ? navigation[event.key] : undefined;
    if (event.key === 'g') {
      if (event.repeat) return;
      const time = now();
      if (lastG !== null && time - lastG < 600) {
        key = 'Home';
        lastG = null;
      } else {
        lastG = time;
      }
      event.preventDefault();
    } else {
      lastG = null;
    }
    if (!key) return;
    event.preventDefault();
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

module.exports = {
  installPresentationKeys,
  script: `(${installPresentationKeys.toString()})(document, KeyboardEvent);`,
};
