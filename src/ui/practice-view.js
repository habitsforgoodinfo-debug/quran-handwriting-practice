import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { mountHeatmapStrip } from './heatmap-strip.js';

export function mountPracticeView(root, { onAllVersesComplete } = {}) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' practice-view';

  const canonicalPane = document.createElement('div'); canonicalPane.className = 'canonical-pane';
  const divider       = document.createElement('div'); divider.className = 'pane-divider';
  const userPane      = document.createElement('div'); userPane.className = 'user-pane';
  const heatmapRoot   = document.createElement('div');
  const banner        = document.createElement('div'); banner.className = 'range-complete-banner';
  banner.style.display = 'none';
  root.append(canonicalPane, divider, userPane, heatmapRoot, banner);

  const heatmap = mountHeatmapStrip(heatmapRoot);

  let rawVerses = [];
  let verseIdx = 0;
  let skeleton = [];
  let matcher = null;

  function loadVerse(idx) {
    verseIdx = idx;
    skeleton = buildSkeleton(rawVerses[idx], { isVerseStart: true });
    matcher = new LiveMatcher(skeleton);
    render();
  }

  function setVerses(verses) {
    rawVerses = verses.slice();
    banner.style.display = 'none';
    canonicalPane.innerHTML = '';
    userPane.innerHTML = '';
    if (rawVerses.length === 0) { matcher = null; skeleton = []; return; }
    loadVerse(0);
  }

  function render() {
    if (!matcher) return;
    canonicalPane.innerHTML = '';
    for (let i = 0; i < skeleton.length; i++) {
      const slot = skeleton[i];
      if (slot.kind === 'wordEnd') {
        canonicalPane.appendChild(document.createTextNode(' '));
        continue;
      }
      const span = document.createElement('span');
      span.textContent = slot.letter;
      const classes = ['canonical-slot'];
      if (slot.kind === 'silent') classes.push('canonical-slot--silent');
      const sealedUpTo = matcher.state.awaiting === 'harakat'
        ? matcher.state.slotIdx
        : matcher.state.slotIdx - 1;
      if (i <= sealedUpTo) classes.push('canonical-slot--sealed');
      else if (i === matcher.state.slotIdx && slot.kind === 'sound') classes.push('canonical-slot--current');
      else classes.push('canonical-slot--future');
      span.className = classes.join(' ');
      canonicalPane.appendChild(span);
    }
    userPane.innerHTML = '';
    for (const t of matcher.state.typed) {
      if (t.kind === 'wordEnd') { userPane.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.textContent = (t.letter || '') + (t.harakat || '');
      s.className = t.kind === 'silent' ? 'user-glyph silent' : 'user-glyph';
      userPane.appendChild(s);
    }
  }

  function advance({ skipped = false } = {}) {
    if (verseIdx + 1 < rawVerses.length) {
      loadVerse(verseIdx + 1);
    } else {
      matcher = null;
      banner.textContent = '✓ range complete — pick a new range above';
      banner.style.display = '';
      if (onAllVersesComplete) onAllVersesComplete();
    }
  }

  function applyKeyResult(result) {
    if (!matcher) return;
    render();
    if (result?.complete) advance({ skipped: false });
  }

  return {
    setVerses,
    applyKeyResult,
    advance,
    refreshHeatmap: (worst) => heatmap.update(worst),
    getMatcher: () => matcher
  };
}
