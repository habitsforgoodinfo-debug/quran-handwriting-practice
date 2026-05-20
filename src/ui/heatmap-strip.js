// Progress + meaning strip. Sits between the user pane and the keypad.
// API kept stable (mountHeatmapStrip + update) for legacy callers/tests.

export function mountHeatmapStrip(root) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' progress-strip';

  const posEl = document.createElement('span');
  posEl.className = 'progress-pos';
  const meaningEl = document.createElement('span');
  meaningEl.className = 'progress-meaning';
  root.append(posEl, meaningEl);

  function update(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      posEl.textContent = '';
      meaningEl.innerHTML = '';
      return;
    }
    const { surahName, ayah, wordIdx, totalWords, meaning } = payload;
    if (!surahName) {
      posEl.textContent = '';
      meaningEl.innerHTML = '';
      return;
    }
    posEl.textContent = `${surahName} · ${ayah} · word ${
      Math.min(wordIdx + 1, totalWords)
    } of ${totalWords}`;
    meaningEl.innerHTML = '';
    if (meaning && meaning.m) {
      const sep = document.createElement('span'); sep.textContent = ' — ';
      const m = document.createElement('span');
      m.className = 'progress-meaning__word';
      if (meaning.role) m.classList.add('progress-meaning__word--' + meaning.role);
      m.textContent = meaning.m;
      meaningEl.append(sep, m);
    }
  }

  return { update };
}
