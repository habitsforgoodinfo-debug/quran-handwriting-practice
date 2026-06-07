import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { mountHeatmapStrip } from './heatmap-strip.js';
import { _diacriticCharByName as CHAR_BY_NAME, parseVerse } from '../verse/parser.js';
import { transliterateWord } from '../verse/transliterate.js';

export function mountPracticeView(root, { onVerseComplete, showTranslit = true } = {}) {
  root.innerHTML = '';
  root.className = (root.className || '') + ' practice-view';

  // Upper section: transliteration of every word in the verse. Omitted
  // entirely in the hifz modes (showTranslit:false) where the canvas is bare.
  const translitPane = document.createElement('div');
  translitPane.className = 'translit-pane';

  // Middle section: what the user has typed so far (Arabic).
  const userPane = document.createElement('div');
  userPane.className = 'user-pane';

  // Hint overlay: shown on a blank canvas, hidden as soon as any glyph appears.
  const typingHint = document.createElement('div');
  typingHint.className = 'user-pane__hint';
  typingHint.setAttribute('aria-hidden', 'true');
  const hintLine1 = document.createElement('span');
  hintLine1.textContent = 'Start typing the letters on the keyboard to begin';
  const hintLine2 = document.createElement('span');
  hintLine2.textContent = 'Made a mistake? Follow the green glow on the keyboard';
  typingHint.append(hintLine1, hintLine2);
  userPane.appendChild(typingHint);

  // Progress + range-complete banner
  const progressRoot = document.createElement('div');
  const banner       = document.createElement('div'); banner.className = 'range-complete-banner';
  banner.style.display = 'none';

  if (showTranslit) root.append(translitPane, userPane, progressRoot, banner);
  else              root.append(userPane, progressRoot, banner);

  const progressStrip = mountHeatmapStrip(progressRoot);

  // Replay button - appended after strip inside progressRoot, hidden by default.
  // Shown only in dictation mode via setReplay().
  const replayBtn = document.createElement('button');
  replayBtn.className = 'replay-btn';
  replayBtn.textContent = '↺';
  replayBtn.title = 'Replay ayah';
  replayBtn.setAttribute('aria-label', 'Replay ayah audio');
  replayBtn.style.display = 'none';
  progressRoot.appendChild(replayBtn);

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
  let requiredLetters = null;
  let requiredHarakat = null;
  // Optional { attempted, total } marker for the dictated review test. When
  // set, the position strip renders an amber "Review N of M" segment.
  let reviewProgress = null;

  function loadCurrentVerse() {
    words = parseVerse(rawText);
    translits = words.map(transliterateWord);
    skeleton = buildSkeleton(rawText, { isVerseStart: true });
    matcher = new LiveMatcher(skeleton, { requiredLetters, requiredHarakat });
    versePerfect = true;
    reviewMode = false;
    render();
    updateProgress();
  }

  function setVerse({ surah: s, surahName: sn, ayah: a, rawText: rt, slide = false,
                       requiredLetters: rl, requiredHarakat: rh, review: rv }) {
    surah = s; surahName = sn; ayah = a; rawText = rt;
    if (rl !== undefined) requiredLetters = rl;
    if (rh !== undefined) requiredHarakat = rh;
    if (rv !== undefined) reviewProgress = rv;
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

  function showBanner(message, buttons = []) {
    matcher = null;
    translitPane.innerHTML = '';
    userPane.innerHTML = '';
    progressStrip.update(null);
    banner.innerHTML = '';
    const msg = document.createElement('div'); msg.className = 'banner-msg';
    msg.textContent = message;
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
  function showRangeEnd(buttons = []) {
    showBanner('✓ surah complete - beautiful work', buttons);
  }
  function showPrompt(message, buttons = []) {
    showBanner(message, buttons);
  }

  function getCurrentWordIdx() {
    if (!matcher || !skeleton.length) return 0;
    const idx = Math.min(matcher.state.slotIdx, skeleton.length - 1);
    return skeleton[idx]?.wordIdx ?? 0;
  }
  function getTotalWords() { return translits.length; }

  function updateProgress() {
    if (!surahName) { progressStrip.update(null); return; }
    // Bare canvas (showTranslit:false) repurposes the strip as a plain
    // position indicator - "<SurahName> · <ayah>" with no word counter.
    if (!showTranslit) {
      progressStrip.update({ surahName, ayah, wordIdx: null, totalWords: null, meaning: null, review: reviewProgress });
      return;
    }
    progressStrip.update({
      surahName, ayah,
      wordIdx: getCurrentWordIdx(),
      totalWords: getTotalWords(),
      meaning: null,
      review: reviewProgress
    });
  }

  function render() {
    if (!matcher) return;
    const currentWord = getCurrentWordIdx();

    // Transliteration pane: one chip per word, current word highlighted,
    // sealed words greened, future words muted. Skipped on the bare canvas.
    let currentTranslitEl = null;
    if (showTranslit) {
      translitPane.innerHTML = '';
      for (let wi = 0; wi < translits.length; wi++) {
        const span = document.createElement('span');
        span.className = 'translit-word';
        if (wi < currentWord)      span.classList.add('translit-word--sealed');
        else if (wi === currentWord) { span.classList.add('translit-word--current'); currentTranslitEl = span; }
        else                         span.classList.add('translit-word--future');
        span.textContent = translits[wi];
        translitPane.appendChild(span);
      }
    }

    // User pane: Arabic letters as the user has typed.
    userPane.innerHTML = '';
    let lastUserEl = null;
    for (const t of matcher.state.typed) {
      if (t.kind === 'wordEnd') { userPane.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.textContent = (t.letter || '') + (t.harakat || '');
      let cls = 'user-glyph';
      if (t.kind === 'silent') cls += ' silent';
      if (t.auto) cls += ' auto';
      s.className = cls;
      userPane.appendChild(s);
      lastUserEl = s;
    }

    // Show the hint when the pane has no visible content, hide it otherwise.
    // Re-append after clearing innerHTML so it is always present in the DOM.
    userPane.appendChild(typingHint);
    typingHint.style.display = lastUserEl ? 'none' : '';

    // Keep the active word + the cursor visible when the verse wraps to
    // more lines than the box can show.
    scrollIntoPane(translitPane, currentTranslitEl);
    scrollIntoPane(userPane, lastUserEl);
  }

  function scrollIntoPane(pane, child) {
    if (!child) return;
    const pTop = pane.scrollTop;
    const pBot = pTop + pane.clientHeight;
    const cTop = child.offsetTop;
    const cBot = cTop + child.offsetHeight;
    if (cTop < pTop)      pane.scrollTop = Math.max(0, cTop - 4);
    else if (cBot > pBot) pane.scrollTop = cBot - pane.clientHeight + 4;
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
    showRangeEnd, showPrompt,
    showReview, exitReview,
    // Set/clear the dictated-review progress marker (amber pill). Pass
    // { attempted, total } to show; null to hide. Repaints the strip.
    setReviewProgress(rv) {
      reviewProgress = rv || null;
      updateProgress();
    },
    isReviewing: () => reviewMode,
    refreshHeatmap: () => updateProgress(),
    getMatcher: () => matcher,
    getCurrentAyah: () => ayah,
    getCurrentSurah: () => surah,
    setMeaningLookup: () => {}, // no-op now; transliteration covers it
    // Show/hide the dictation replay button. Pass a callback to show; null hides.
    setReplay(fn) {
      if (fn) {
        replayBtn.style.display = '';
        replayBtn.onclick = fn;
      } else {
        replayBtn.style.display = 'none';
        replayBtn.onclick = null;
      }
    },
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
