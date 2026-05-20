import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { mountHeatmapStrip } from './heatmap-strip.js';
import { _diacriticCharByName as CHAR_BY_NAME, parseVerse } from '../verse/parser.js';
import { transliterateWord } from '../verse/transliterate.js';

export function mountPracticeView(root, { onVerseComplete } = {}) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' practice-view';

  // Upper section: transliteration of every word in the verse.
  const translitPane = document.createElement('div');
  translitPane.className = 'translit-pane';

  // Middle section: what the user has typed so far (Arabic).
  const userPane = document.createElement('div');
  userPane.className = 'user-pane';

  // Progress + range-complete banner
  const progressRoot = document.createElement('div');
  const banner       = document.createElement('div'); banner.className = 'range-complete-banner';
  banner.style.display = 'none';

  root.append(translitPane, userPane, progressRoot, banner);

  const progressStrip = mountHeatmapStrip(progressRoot);

  let surah = 0;
  let surahName = '';
  let ayah = 0;
  let rawText = '';
  let words = [];      // parsed glyphs per word, for transliteration
  let translits = [];  // string per word
  let skeleton = [];
  let matcher = null;
  let versePerfect = true;
  let reviewMode = false;

  function loadCurrentVerse() {
    words = parseVerse(rawText);
    translits = words.map(transliterateWord);
    skeleton = buildSkeleton(rawText, { isVerseStart: true });
    matcher = new LiveMatcher(skeleton);
    versePerfect = true;
    reviewMode = false;
    render();
    updateProgress();
  }

  function setVerse({ surah: s, surahName: sn, ayah: a, rawText: rt, slide = false }) {
    surah = s; surahName = sn; ayah = a; rawText = rt;
    banner.style.display = 'none';
    banner.innerHTML = '';
    if (!rawText) {
      translitPane.innerHTML = '';
      userPane.innerHTML = '';
      matcher = null; skeleton = []; words = []; translits = [];
      progressStrip.update(null);
      return;
    }
    if (slide) {
      translitPane.classList.add('translit-pane--sliding');
      userPane.classList.add('user-pane--sliding');
      setTimeout(() => {
        loadCurrentVerse();
        translitPane.classList.remove('translit-pane--sliding');
        userPane.classList.remove('user-pane--sliding');
      }, 220);
    } else {
      loadCurrentVerse();
    }
  }

  function showRangeEnd(buttons = []) {
    matcher = null;
    translitPane.innerHTML = '';
    userPane.innerHTML = '';
    progressStrip.update(null);
    banner.innerHTML = '';
    const msg = document.createElement('div'); msg.className = 'banner-msg';
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
  function getTotalWords() { return translits.length; }

  function updateProgress() {
    if (!surahName) { progressStrip.update(null); return; }
    progressStrip.update({
      surahName, ayah,
      wordIdx: getCurrentWordIdx(),
      totalWords: getTotalWords(),
      meaning: null
    });
  }

  function render() {
    if (!matcher) return;
    const currentWord = getCurrentWordIdx();

    // Transliteration pane: one chip per word, current word highlighted,
    // sealed words greened, future words muted.
    translitPane.innerHTML = '';
    for (let wi = 0; wi < translits.length; wi++) {
      const span = document.createElement('span');
      span.className = 'translit-word';
      if (wi < currentWord)      span.classList.add('translit-word--sealed');
      else if (wi === currentWord) span.classList.add('translit-word--current');
      else                         span.classList.add('translit-word--future');
      span.textContent = translits[wi];
      translitPane.appendChild(span);
    }

    // User pane: Arabic letters as the user has typed.
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
    if (!matcher || reviewMode) return;
    render();
    updateProgress();
    if (result?.complete) finishVerse();
  }

  function finishVerse() {
    translitPane.classList.add('translit-pane--celebrate');
    setTimeout(() => translitPane.classList.remove('translit-pane--celebrate'), 700);
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

  function showReview(verse) {
    reviewMode = true;
    const tl = parseVerse(verse.rawText).map(transliterateWord);
    translitPane.innerHTML = '';
    for (const t of tl) {
      const sp = document.createElement('span');
      sp.className = 'translit-word translit-word--sealed';
      sp.textContent = t;
      translitPane.appendChild(sp);
    }
    userPane.innerHTML = '';
    const arabic = document.createElement('span');
    arabic.className = 'user-glyph';
    arabic.textContent = verse.rawText;
    userPane.appendChild(arabic);
    progressStrip.update({
      surahName: 'Reviewing', ayah: verse.ayah,
      wordIdx: 0, totalWords: 1, meaning: null
    });
  }

  function exitReview() {
    reviewMode = false;
    if (rawText) { render(); updateProgress(); }
  }

  function hasInProgressInput() {
    if (!matcher) return false;
    return matcher.state.typed.some(t => t.kind === 'sound');
  }
  function noteWrongAttempt() { versePerfect = false; }

  return {
    setVerse,
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
    setMeaningLookup: () => {}, // no-op now; transliteration covers it
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
