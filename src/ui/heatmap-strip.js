// Progress + meaning strip. Sits between the user pane and the keypad.
// API kept stable (mountHeatmapStrip + update) for legacy callers/tests.

// "Review N of M" pill text. Kept as a named helper so the format lives in
// one place (mirrors src/review/queue.js reviewLabel, which adds position).
function reviewPillText(review) {
  return `Review ${review.attempted} of ${review.total}`;
}

export function mountHeatmapStrip(root) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' progress-strip';

  // Review marker (amber pill) - rendered before the position text when the
  // payload carries a `review` field. Hidden otherwise.
  const reviewEl = document.createElement('span');
  reviewEl.className = 'progress-review';
  reviewEl.style.display = 'none';
  const posEl = document.createElement('span');
  posEl.className = 'progress-pos';
  const meaningEl = document.createElement('span');
  meaningEl.className = 'progress-meaning';

  root.append(reviewEl, posEl, meaningEl);

  function update(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      reviewEl.style.display = 'none';
      reviewEl.textContent = '';
      posEl.textContent = '';
      meaningEl.innerHTML = '';
      return;
    }
    const { surahName, ayah, wordIdx, totalWords, meaning, review } = payload;
    // Review marker is independent of the position text - render it whenever
    // present so the amber pill stays visible across the review queue.
    if (review && review.total > 0) {
      reviewEl.textContent = reviewPillText(review);
      reviewEl.style.display = '';
    } else {
      reviewEl.style.display = 'none';
      reviewEl.textContent = '';
    }
    if (!surahName) {
      posEl.textContent = '';
      meaningEl.innerHTML = '';
      return;
    }
    // When word counters are omitted (canvas position-indicator mode) show
    // just "<SurahName> · <ayah>".
    if (wordIdx == null || totalWords == null) {
      posEl.textContent = `${surahName} · ${ayah}`;
    } else {
      posEl.textContent = `${surahName} · ${ayah} · word ${
        Math.min(wordIdx + 1, totalWords)
      } of ${totalWords}`;
    }
    // Word-by-word meaning now renders interlinear under each canonical
    // word, so the strip only shows transliteration of the current word.
    meaningEl.innerHTML = '';
    if (meaning && meaning.tl) {
      const sep = document.createElement('span'); sep.textContent = ' · ';
      const t = document.createElement('span');
      t.className = 'progress-meaning__tl';
      t.textContent = meaning.tl;
      meaningEl.append(sep, t);
      if (meaning.root && meaning.root !== '-') {
        const r = document.createElement('span');
        r.className = 'progress-meaning__root';
        r.textContent = ' · root ' + meaning.root;
        meaningEl.appendChild(r);
      }
    }
  }

  return { update };
}
