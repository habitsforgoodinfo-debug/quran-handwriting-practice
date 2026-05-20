// This strip now surfaces practical context — current verse and word
// progress, plus a short mnemonic for the next expected sound. The old
// "weakest harakat" chip list was opaque to users.
//
// API kept stable for callers: mountHeatmapStrip(root) → { update }.
// `update` now accepts an object payload; an empty/falsy payload clears.

export function mountHeatmapStrip(root) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' progress-strip';

  const posEl = document.createElement('span');
  posEl.className = 'progress-pos';
  const tipEl = document.createElement('span');
  tipEl.className = 'progress-tip';
  root.append(posEl, tipEl);

  function update(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      posEl.textContent = '';
      tipEl.textContent = '';
      return;
    }
    const { surahName, ayah, wordIdx, totalWords, tip } = payload;
    if (!surahName) {
      posEl.textContent = '';
      tipEl.textContent = '';
      return;
    }
    posEl.textContent = `${surahName} · ${ayah} · word ${
      Math.min(wordIdx + 1, totalWords)
    } of ${totalWords}`;
    tipEl.textContent = tip ? ` · ${tip}` : '';
  }

  return { update };
}
