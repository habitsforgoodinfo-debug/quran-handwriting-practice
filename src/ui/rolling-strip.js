// A tiny scrolling running-paragraph of verses the user has written.
// Lays out RTL like a mushaf page: each verse flows into the next,
// separated by the verse-end glyph ۝, and the latest verse is bold so
// the eye can find it. Auto-scrolls to keep the newest text in view.

import { cleanVerseForDisplay } from '../verse/parser.js';

const MAX_VERSES = 60;

export function mountRollingStrip(root) {
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'rolling-strip';
  wrap.dir = 'rtl';
  root.appendChild(wrap);

  const verses = [];

  function render() {
    wrap.innerHTML = '';
    verses.forEach((v, i) => {
      const isLast = i === verses.length - 1;
      const text = document.createElement('span');
      text.className = 'rolling-strip__text' + (isLast ? ' rolling-strip__text--latest' : '');
      text.textContent = cleanVerseForDisplay(v);
      const marker = document.createElement('span');
      marker.className = 'rolling-strip__marker';
      marker.textContent = ' ۝ ';
      wrap.append(text, marker);
    });
    // Newest text sits at the end of the running paragraph - scroll so
    // the bottom of the strip stays in view.
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
