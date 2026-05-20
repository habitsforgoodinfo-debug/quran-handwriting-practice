import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { mountHeatmapStrip } from './heatmap-strip.js';
import { _diacriticCharByName as CHAR_BY_NAME } from '../verse/parser.js';

export function mountPracticeView(root, { onVerseComplete, onRangeEnd } = {}) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' practice-view';

  const canonicalPane = document.createElement('div'); canonicalPane.className = 'canonical-pane';
  const divider       = document.createElement('div'); divider.className = 'pane-divider';
  const userPane      = document.createElement('div'); userPane.className = 'user-pane';
  const progressRoot  = document.createElement('div');
  const banner        = document.createElement('div'); banner.className = 'range-complete-banner';
  banner.style.display = 'none';
  root.append(canonicalPane, divider, userPane, progressRoot, banner);

  const progressStrip = mountHeatmapStrip(progressRoot);

  let surah = 0;
  let surahName = '';
  let ayah = 0;
  let rawText = '';
  let skeleton = [];
  let matcher = null;
  let versePerfect = true;

  function loadCurrentVerse() {
    skeleton = buildSkeleton(rawText, { isVerseStart: true });
    matcher = new LiveMatcher(skeleton);
    versePerfect = true;
    render();
    updateProgress();
  }

  function setVerse({ surah: s, surahName: sn, ayah: a, rawText: rt, slide = false }) {
    surah = s; surahName = sn; ayah = a; rawText = rt;
    banner.style.display = 'none';
    banner.innerHTML = '';
    if (!rawText) {
      canonicalPane.innerHTML = '';
      userPane.innerHTML = '';
      matcher = null; skeleton = [];
      progressStrip.update(null);
      return;
    }
    if (slide) {
      canonicalPane.classList.add('canonical-pane--sliding');
      userPane.classList.add('user-pane--sliding');
      // Render after the slide-out finishes so the new verse slides in.
      setTimeout(() => {
        loadCurrentVerse();
        canonicalPane.classList.remove('canonical-pane--sliding');
        userPane.classList.remove('user-pane--sliding');
      }, 220);
    } else {
      loadCurrentVerse();
    }
  }

  function showRangeEnd(buttons = []) {
    matcher = null;
    canonicalPane.innerHTML = '';
    userPane.innerHTML = '';
    progressStrip.update(null);
    banner.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'banner-msg';
    msg.textContent = '✓ surah complete — beautiful work';
    banner.appendChild(msg);
    const row = document.createElement('div'); row.className = 'banner-actions';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'banner-btn ' + (b.cls || '');
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      row.appendChild(btn);
    }
    banner.appendChild(row);
    banner.style.display = '';
  }

  function getCurrentWordIdx() {
    if (!matcher || !skeleton.length) return 0;
    const idx = Math.min(matcher.state.slotIdx, skeleton.length - 1);
    return skeleton[idx]?.wordIdx ?? 0;
  }
  function getTotalWords() {
    if (!skeleton.length) return 0;
    return Math.max(0, ...skeleton.map(s => (s.wordIdx ?? -1) + 1));
  }

  let meaningLookup = null; // (surah, ayah, wordIdx) => {m, role}|null
  function setMeaningLookup(fn) { meaningLookup = fn; }

  function updateProgress() {
    if (!surahName) { progressStrip.update(null); return; }
    const wi = getCurrentWordIdx();
    let meaning = null;
    if (meaningLookup) meaning = meaningLookup(surah, ayah, wi);
    progressStrip.update({
      surahName, ayah,
      wordIdx: wi,
      totalWords: getTotalWords(),
      meaning
    });
  }

  function render() {
    if (!matcher) return;
    canonicalPane.innerHTML = '';
    // Group consecutive non-wordEnd slots by wordIdx into word blocks; each
    // block stacks the Arabic slots above its English meaning.
    const sealedUpTo = matcher.state.awaiting === 'harakat'
      ? matcher.state.slotIdx
      : matcher.state.slotIdx - 1;

    const blocks = [];
    let current = null;
    for (let i = 0; i < skeleton.length; i++) {
      const slot = skeleton[i];
      if (slot.kind === 'wordEnd') { current = null; continue; }
      if (!current || current.wordIdx !== slot.wordIdx) {
        current = { wordIdx: slot.wordIdx, slots: [] };
        blocks.push(current);
      }
      current.slots.push({ slot, idx: i });
    }

    for (const block of blocks) {
      const wordEl = document.createElement('span');
      wordEl.className = 'canonical-word';

      const top = document.createElement('span'); top.className = 'canonical-word__top';
      for (const { slot, idx } of block.slots) {
        const span = document.createElement('span');
        const ornamentChars = (slot.expectedHarakat?.ornaments || [])
          .map(n => CHAR_BY_NAME[n]).filter(Boolean).join('');
        span.textContent = slot.letter + ornamentChars;
        const classes = ['canonical-slot'];
        if (slot.kind === 'silent') classes.push('canonical-slot--silent');
        if (idx <= sealedUpTo) classes.push('canonical-slot--sealed');
        else if (idx === matcher.state.slotIdx && slot.kind === 'sound') classes.push('canonical-slot--current');
        else classes.push('canonical-slot--future');
        span.className = classes.join(' ');
        top.appendChild(span);
      }
      wordEl.appendChild(top);

      // Meaning row beneath the word.
      const meaning = meaningLookup ? meaningLookup(surah, ayah, block.wordIdx) : null;
      const bot = document.createElement('span'); bot.className = 'canonical-word__meaning';
      if (meaning && meaning.m) {
        if (meaning.role) bot.classList.add('canonical-word__meaning--' + meaning.role);
        bot.textContent = meaning.m;
        if (meaning.tl) bot.setAttribute('title', meaning.tl + (meaning.root ? ` (root: ${meaning.root})` : ''));
      } else {
        bot.textContent = ' '; // keep height so words align
      }
      wordEl.appendChild(bot);

      canonicalPane.appendChild(wordEl);
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

  function applyKeyResult(result) {
    if (!matcher) return;
    render();
    updateProgress();
    if (result?.complete) finishVerse();
  }

  function finishVerse() {
    canonicalPane.classList.add('canonical-pane--celebrate');
    setTimeout(() => canonicalPane.classList.remove('canonical-pane--celebrate'), 700);
    const completedSurah = surah, completedAyah = ayah, completedRaw = rawText;
    const wasPerfect = versePerfect;
    setTimeout(() => {
      if (onVerseComplete) {
        onVerseComplete({
          surah: completedSurah,
          ayah: completedAyah,
          rawText: completedRaw,
          perfect: wasPerfect
        });
      }
    }, 600);
  }

  function hasInProgressInput() {
    if (!matcher) return false;
    return matcher.state.typed.some(t => t.kind === 'sound');
  }

  function noteWrongAttempt() { versePerfect = false; }

  return {
    setVerse,
    setMeaningLookup,
    applyKeyResult,
    noteWrongAttempt,
    hasInProgressInput,
    showRangeEnd,
    // legacy alias kept for tests
    refreshHeatmap: () => updateProgress(),
    getMatcher: () => matcher,
    getCurrentAyah: () => ayah,
    getCurrentSurah: () => surah,
    // legacy alias kept for tests
    setVerses: (verses) => {
      // best-effort backwards compat for older callers/tests
      if (!verses || verses.length === 0) {
        setVerse({ surah: 0, surahName: '', ayah: 0, rawText: '' });
      } else {
        setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: verses[0] });
      }
    },
    advance: () => { /* iter-2 alias — no-op now; main owns advance */ }
  };
}
