// A tiny scrolling log of recently-completed verses, shown between the
// canvas and the keypad. Latest verse always anchored at the bottom.

const MAX_VERSES = 30;

export function mountRollingStrip(root) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'rolling-strip';
  root.appendChild(wrap);

  const verses = [];

  function render() {
    wrap.innerHTML = '';
    for (const v of verses) {
      const line = document.createElement('div');
      line.className = 'rolling-strip__line';
      line.textContent = v;
      wrap.appendChild(line);
    }
    // Scroll the strip so the newest line sits at the bottom (visible).
    wrap.scrollTop = wrap.scrollHeight;
  }

  function pushVerse(rawText) {
    if (!rawText) return;
    verses.push(rawText);
    if (verses.length > MAX_VERSES) verses.splice(0, verses.length - MAX_VERSES);
    render();
  }

  function clear() {
    verses.length = 0;
    render();
  }

  function setHistory(list) {
    verses.length = 0;
    for (const t of (list || []).slice(-MAX_VERSES)) verses.push(t);
    render();
  }

  return { pushVerse, clear, setHistory };
}
