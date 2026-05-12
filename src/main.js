import { loadQuran, getVerse } from './data/quran-loader.js';
import { parseVerse, parseWord } from './verse/parser.js';
import { mountHeader } from './ui/header.js';
import { mountVerseDisplay } from './ui/verse-display.js';
import { mountKeypad } from './ui/keypad.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { showSummary } from './ui/summary.js';
import { align } from './compare/aligner.js';
import { getSettings, updateSettings } from './store/settings.js';
import { recordError, resetStats } from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';
import { computeKeypadLetters } from './keypad/keypad-letters.js';

const state = {
  surah: 1, fromAyah: 1, toAyah: 1,
  parsedVerses: [],
  cursor: { verseIdx: 0, wordIdx: 0 },
  history: [],
  settings: null,
  session: { wordsWritten: 0, wordsTotal: 0, letterErrors: {}, diacriticErrors: {}, letterErrorsTotal: 0, diacriticErrorsTotal: 0 },
  verseAlignments: []
};

const player = new AyahPlayer();
let verseDisplayApi = null;
let keypadApi = null;
let currentVerseLine = null;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
  await loadQuran();
  state.settings = await getSettings();

  const headerEl = document.getElementById('header');
  const verseEl  = document.getElementById('verse-display');
  const keypadEl = document.getElementById('keypad-view');

  verseDisplayApi = mountVerseDisplay(verseEl, { onPlayVerse: playCurrentVerse });
  keypadApi = mountKeypad(keypadEl, {
    onSubmit: handleSubmit,
    letters: [],
    settings: state.settings
  });

  mountHeader(headerEl, {
    initial: { surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah },
    onChange: handleRangeChange,
    onOpenSettings: openSettings
  });
}

function handleRangeChange({ surah, fromAyah, toAyah }) {
  state.surah = surah;
  state.fromAyah = fromAyah;
  state.toAyah = toAyah;
  state.parsedVerses = [];
  for (let a = fromAyah; a <= toAyah; a++) {
    state.parsedVerses.push(parseVerse(getVerse(surah, a)));
  }
  state.cursor = { verseIdx: 0, wordIdx: 0 };
  state.history = [];
  state.verseAlignments = state.parsedVerses.map(v => v.map(() => null));
  state.session = {
    wordsWritten: 0,
    wordsTotal: state.parsedVerses.reduce((s, v) => s + v.length, 0),
    letterErrors: {}, diacriticErrors: {},
    letterErrorsTotal: 0, diacriticErrorsTotal: 0
  };
  verseDisplayApi.reset();
  currentVerseLine = verseDisplayApi.startNewVerse();
  keypadApi.setLetters(computeKeypadLetters(state.parsedVerses));
  keypadApi.clearInput();
}

// Convert one user-typed word (string) to the `recognized` shape expected by align().
function userWordToRecognized(userWordText) {
  const userGlyphs = parseWord(userWordText);
  const letters = userGlyphs.map(g => ({ matchedLetter: g.letter, confidence: 1, unclear: false }));
  const diacritics = [];
  for (const g of userGlyphs) {
    if (g.diacritics.length > 0) diacritics.push(g.diacritics[0]);
    else diacritics.push(null);
  }
  return { letters, diacritics };
}

function handleSubmit(text) {
  const userWords = text.trim().split(/\s+/).filter(Boolean);
  if (userWords.length === 0) return;

  for (const userWord of userWords) {
    const word = currentExpectedWord();
    if (!word) break;

    const recognized = userWordToRecognized(userWord);
    const alignment = align(word, recognized);

    state.verseAlignments[state.cursor.verseIdx][state.cursor.wordIdx] = alignment;

    currentVerseLine.appendWord(alignment);

    for (const r of alignment.result) {
      if (r.letterMatch === 'wrong' || r.letterMatch === 'missing') {
        recordError({ kind: 'letter', value: r.expected.letter });
        bumpSession('letter', r.expected.letter);
      }
      if (r.diacriticMatch === 'wrong' || r.diacriticMatch === 'missing') {
        const d = r.expected.diacritics[0];
        if (d) { recordError({ kind: 'diacritic', value: d }); bumpSession('diacritic', d); }
      }
    }

    state.session.wordsWritten++;
    state.history.push({ verseIdx: state.cursor.verseIdx, wordIdx: state.cursor.wordIdx });
    advanceCursor();
  }
}

function bumpSession(kind, value) {
  const map = kind === 'letter' ? state.session.letterErrors : state.session.diacriticErrors;
  map[value] = (map[value] || 0) + 1;
  if (kind === 'letter') state.session.letterErrorsTotal++;
  else state.session.diacriticErrorsTotal++;
}

function currentExpectedWord() {
  const verse = state.parsedVerses[state.cursor.verseIdx];
  if (!verse) return null;
  return verse[state.cursor.wordIdx];
}

function advanceCursor() {
  state.cursor.wordIdx++;
  const verse = state.parsedVerses[state.cursor.verseIdx];
  if (state.cursor.wordIdx >= verse.length) {
    currentVerseLine.appendCorrectVerse(verse, state.verseAlignments[state.cursor.verseIdx]);

    state.cursor.verseIdx++;
    state.cursor.wordIdx = 0;
    if (state.cursor.verseIdx >= state.parsedVerses.length) {
      showSummary(document.body, {
        sessionStats: state.session,
        onPracticeAgain: () => handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah }),
        onPickNew: () => {
          const surahSel = document.querySelector('#header select.surah');
          if (surahSel) { surahSel.focus(); surahSel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        }
      });
      return;
    }
    currentVerseLine = verseDisplayApi.startNewVerse();
  }
}

function openSettings() {
  mountSettingsModal(document.body, {
    settings: state.settings,
    onChange: async (patch) => { state.settings = await updateSettings(patch); },
    onResetStats: () => resetStats()
  });
}

function playCurrentVerse() {
  const ayah = state.fromAyah + state.cursor.verseIdx;
  const url = buildAyahUrl(state.settings.reciter, state.surah, ayah);
  player.play(url).catch(() => showRetryToast('Could not load audio.', playCurrentVerse));
}

function showRetryToast(message, onRetry) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message + ' ';
  const retry = document.createElement('button');
  retry.textContent = 'Retry';
  retry.className = 'toast-retry';
  retry.addEventListener('click', () => { toast.remove(); onRetry(); });
  const dismiss = document.createElement('button');
  dismiss.textContent = '×';
  dismiss.className = 'toast-dismiss';
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(text, retry, dismiss);
  document.body.appendChild(toast);
}

init().catch((err) => {
  console.error('Init failed:', err);
  showRetryToast('Failed to load app.', () => location.reload());
});
