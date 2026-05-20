import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { mountHeatmapStrip } from './heatmap-strip.js';
import { _diacriticCharByName as CHAR_BY_NAME } from '../verse/parser.js';
import { CHEATSHEET } from '../data/cheatsheet.js';

export function mountPracticeView(root, { onVerseComplete, onPrevAyah } = {}) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' practice-view';

  // Top bar: prev-ayah arrow + position label.
  const topBar = document.createElement('div'); topBar.className = 'practice-topbar';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'practice-prev'; prevBtn.textContent = '← previous ayah';
  prevBtn.title = 'Review the previous ayah you wrote';
  prevBtn.addEventListener('click', () => onPrevAyah && onPrevAyah());
  topBar.appendChild(prevBtn);

  // Stacked panes:
  //   .verse-stack   — Arabic on top, English meanings below, scroll in sync
  //   .user-pane     — what the user has typed so far (souvenir line)
  //   .cheatsheet    — short grammar / vocab notes, scrollable
  const verseStack    = document.createElement('div'); verseStack.className = 'verse-stack';
  const canonicalPane = document.createElement('div'); canonicalPane.className = 'canonical-pane';
  const meaningPane   = document.createElement('div'); meaningPane.className = 'meaning-pane';
  verseStack.append(canonicalPane, meaningPane);

  const userPane      = document.createElement('div'); userPane.className = 'user-pane';
  const progressRoot  = document.createElement('div');
  const cheatPane     = document.createElement('div'); cheatPane.className = 'cheatsheet';
  const banner        = document.createElement('div'); banner.className = 'range-complete-banner';
  banner.style.display = 'none';

  root.append(topBar, verseStack, userPane, progressRoot, cheatPane, banner);

  renderCheatsheet(cheatPane);

  const progressStrip = mountHeatmapStrip(progressRoot);

  let surah = 0;
  let surahName = '';
  let ayah = 0;
  let rawText = '';
  let skeleton = [];
  let matcher = null;
  let versePerfect = true;
  let meaningLookup = null;
  let reviewMode = false;
  let reviewVerse = null;

  function setMeaningLookup(fn) { meaningLookup = fn; }

  function loadCurrentVerse() {
    skeleton = buildSkeleton(rawText, { isVerseStart: true });
    matcher = new LiveMatcher(skeleton);
    versePerfect = true;
    reviewMode = false; reviewVerse = null;
    render();
    updateProgress();
  }

  function setVerse({ surah: s, surahName: sn, ayah: a, rawText: rt, slide = false }) {
    surah = s; surahName = sn; ayah = a; rawText = rt;
    banner.style.display = 'none';
    banner.innerHTML = '';
    if (!rawText) {
      canonicalPane.innerHTML = ''; meaningPane.innerHTML = '';
      userPane.innerHTML = '';
      matcher = null; skeleton = [];
      progressStrip.update(null);
      return;
    }
    if (slide) {
      canonicalPane.classList.add('canonical-pane--sliding');
      userPane.classList.add('user-pane--sliding');
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
    canonicalPane.innerHTML = ''; meaningPane.innerHTML = '';
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

  function buildWordBlocks() {
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
    return blocks;
  }

  function renderArabicWord(block, sealedUpTo, currentSlotIdx) {
    const wordEl = document.createElement('span');
    wordEl.className = 'verse-word';
    for (const { slot, idx } of block.slots) {
      const span = document.createElement('span');
      const ornamentChars = (slot.expectedHarakat?.ornaments || [])
        .map(n => CHAR_BY_NAME[n]).filter(Boolean).join('');
      span.textContent = slot.letter + ornamentChars;
      const classes = ['canonical-slot'];
      if (slot.kind === 'silent') classes.push('canonical-slot--silent');
      if (idx <= sealedUpTo) classes.push('canonical-slot--sealed');
      else if (idx === currentSlotIdx && slot.kind === 'sound') classes.push('canonical-slot--current');
      else classes.push('canonical-slot--future');
      span.className = classes.join(' ');
      wordEl.appendChild(span);
    }
    return wordEl;
  }

  function renderMeaningWord(block) {
    const meaning = meaningLookup ? meaningLookup(surah, ayah, block.wordIdx) : null;
    const cell = document.createElement('span');
    cell.className = 'meaning-word';
    if (!meaning) {
      cell.appendChild(document.createElement('span')); // spacer
      return cell;
    }

    // Grammar tag chip
    if (meaning.grm) {
      const grm = document.createElement('span');
      grm.className = 'meaning-grm';
      grm.textContent = meaning.grm;
      cell.appendChild(grm);
    }

    // English meaning with role-coloring
    const text = document.createElement('span');
    text.className = 'meaning-text';
    if (meaning.role) text.classList.add('meaning-text--' + meaning.role);
    if (Array.isArray(meaning.parts) && meaning.parts.length) {
      for (let i = 0; i < meaning.parts.length; i++) {
        const p = meaning.parts[i];
        const seg = document.createElement('span');
        seg.className = 'meaning-part meaning-part--' + (p.k || 'noun');
        seg.textContent = p.t;
        if (p.root) seg.setAttribute('title', 'root ' + p.root);
        if (i > 0) text.appendChild(document.createTextNode(' '));
        text.appendChild(seg);
      }
    } else {
      text.textContent = meaning.m || '';
    }
    cell.appendChild(text);

    // Root + transliteration below
    const sub = document.createElement('span');
    sub.className = 'meaning-sub';
    const tl = document.createElement('span');
    tl.className = 'meaning-tl'; tl.textContent = meaning.tl || '';
    sub.appendChild(tl);
    if (meaning.root && meaning.root !== '—') {
      const r = document.createElement('span');
      r.className = 'meaning-root';
      r.textContent = ' · ' + meaning.root;
      sub.appendChild(r);
    }
    cell.appendChild(sub);
    return cell;
  }

  function render() {
    if (!matcher) return;
    canonicalPane.innerHTML = ''; meaningPane.innerHTML = '';

    const sealedUpTo = matcher.state.awaiting === 'harakat'
      ? matcher.state.slotIdx
      : matcher.state.slotIdx - 1;
    const blocks = buildWordBlocks();
    for (const block of blocks) {
      canonicalPane.appendChild(renderArabicWord(block, sealedUpTo, matcher.state.slotIdx));
      meaningPane.appendChild(renderMeaningWord(block));
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

  // Render a previous verse in read-only mode (no matcher state).
  function showReview(verse) {
    reviewMode = true; reviewVerse = verse;
    const sk = buildSkeleton(verse.rawText, { isVerseStart: true });
    canonicalPane.innerHTML = ''; meaningPane.innerHTML = '';
    const blocks = [];
    let cur = null;
    for (let i = 0; i < sk.length; i++) {
      const slot = sk[i];
      if (slot.kind === 'wordEnd') { cur = null; continue; }
      if (!cur || cur.wordIdx !== slot.wordIdx) { cur = { wordIdx: slot.wordIdx, slots: [] }; blocks.push(cur); }
      cur.slots.push({ slot, idx: i });
    }
    for (const block of blocks) {
      // All sealed for the review look.
      canonicalPane.appendChild(renderArabicWord(block, sk.length, -1));
      meaningPane.appendChild(renderMeaningWord({ wordIdx: block.wordIdx }));
    }
    userPane.innerHTML = '';
    progressStrip.update({
      surahName: 'Reviewing', ayah: verse.ayah,
      wordIdx: 0, totalWords: 1, meaning: null
    });
  }

  function exitReview() {
    reviewMode = false; reviewVerse = null;
    render();
    updateProgress();
  }

  function applyKeyResult(result) {
    if (!matcher || reviewMode) return;
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
    showReview, exitReview,
    isReviewing: () => reviewMode,
    refreshHeatmap: () => updateProgress(),
    getMatcher: () => matcher,
    getCurrentAyah: () => ayah,
    getCurrentSurah: () => surah,
    // legacy aliases
    setVerses: (verses) => {
      if (!verses || verses.length === 0) {
        setVerse({ surah: 0, surahName: '', ayah: 0, rawText: '' });
      } else {
        setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: verses[0] });
      }
    },
    advance: () => {}
  };
}

function renderCheatsheet(root) {
  root.innerHTML = '';
  const summary = document.createElement('div'); summary.className = 'cheatsheet__head';
  summary.textContent = '📚 Quick reference — common particles, pronouns, patterns';
  root.appendChild(summary);
  const inner = document.createElement('div'); inner.className = 'cheatsheet__inner';
  for (const section of CHEATSHEET) {
    const sec = document.createElement('section'); sec.className = 'cheat-section';
    const h = document.createElement('h5'); h.textContent = section.title; sec.appendChild(h);
    const list = document.createElement('div'); list.className = 'cheat-list';
    for (const item of section.items) {
      const row = document.createElement('div'); row.className = 'cheat-row';
      const ar = document.createElement('span'); ar.className = 'cheat-ar'; ar.textContent = item.ar;
      const tl = document.createElement('span'); tl.className = 'cheat-tl'; tl.textContent = item.tl;
      const m  = document.createElement('span'); m.className = 'cheat-m';   m.textContent = item.m;
      row.append(ar, tl, m);
      list.appendChild(row);
    }
    sec.appendChild(list);
    inner.appendChild(sec);
  }
  root.appendChild(inner);
}
