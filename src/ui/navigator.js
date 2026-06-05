// Card-stack screen router. All motion is driven by CSS classes; no inline
// transforms here. CSS for .card, .card--active, .card--left lands later.

export function mountNavigator(rootEl, { onChange } = {}) {
  const cards = new Map(); // name -> element
  let history = [];        // stack of card names
  let swipeStartX = null;

  rootEl.addEventListener('pointerdown', (e) => { swipeStartX = e.clientX; });
  rootEl.addEventListener('pointerup', (e) => {
    if (swipeStartX !== null && e.clientX - swipeStartX > 60) back();
    swipeStartX = null;
  });
  rootEl.addEventListener('pointercancel', () => { swipeStartX = null; });

  function _activate(name, pushLeft) {
    for (const [n, el] of cards) {
      if (n === name) {
        el.classList.add('card--active');
        el.classList.remove('card--left');
      } else {
        el.classList.remove('card--active');
        if (pushLeft) el.classList.add('card--left');
        else el.classList.remove('card--left');
      }
    }
    if (onChange) onChange(name);
  }

  function register(name, el) {
    el.classList.add('card');
    rootEl.appendChild(el);
    cards.set(name, el);
  }

  function go(name, { direction } = {}) {
    if (!cards.has(name)) return;
    if (history[history.length - 1] === name) return;

    const existingIdx = history.lastIndexOf(name);
    if (existingIdx !== -1) {
      // Navigating back to a card already in history - truncate to that entry
      // and treat as a backward move (pushLeft animation).
      history.length = existingIdx + 1;
      _activate(name, true);
    } else {
      // Forward navigation to a new card.
      const pushLeft = direction === 'back';
      history.push(name);
      _activate(name, pushLeft);
    }
  }

  function back() {
    if (history.length <= 1) return;
    history.pop();
    const prev = history[history.length - 1];
    _activate(prev, false);
  }

  function current() {
    return history[history.length - 1] ?? null;
  }

  return { register, go, back, current };
}
