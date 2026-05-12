import { loadQuran, getVerse } from './data/quran-loader.js';
import { parseVerse } from './verse/parser.js';
import { parseUserStream } from './compare/user-stream.js';
import { smartMatch } from './compare/smart-match.js';
import { mountHeader } from './ui/header.js';
import { mountVerseDisplay } from './ui/verse-display.js';
import { mountKeypad } from './ui/keypad.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { showSummary } from './ui/summary.js';
import { getSettings, updateSettings } from './store/settings.js';
import { recordError, resetStats } from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';

const state = {
  surah: 1, fromAyah: 1, toAyah: 1,
  parsedVerses: [],
  cursor: { verseIdx: 0, wordIdx: 0 },
  settings: null,
  session: { wordsWritten: 0, wordsTotal: 0, letterErrors: {}, diacriticErrors: {}, letterErrorsTotal: 0, diacriticErrorsTotal: 0 }
};

const player = new AyahPlayer();
let verseDisplayApi = null;
let keypadApi = null;
let currentVerseLine = null;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
  state.settings = await getSettings();
  await loadQuran(state.settings.script);

  const headerEl = document.getElementById('header');
  const verseEl  = document.getElementById('verse-display');
  const keypadEl = document.getElementById('keypad-view');

  verseDisplayApi = mountVerseDisplay(verseEl, { onPlayVerse: playCurrentVerse });
  keypadApi = mountKeypad(keypadEl, {
    onSubmit: handleSubmit,
    settings: state.settings
  });

  mountHeader(headerEl, {
    initial: { surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah, script: state.settings.script },
    onChange: handleRangeChange,
    onOpenSettings: openSettings,
    onScriptToggle: handleScriptToggle
  });
}

async function handleScriptToggle(nextScript) {
  state.settings = await updateSettings({ script: nextScript });
  await loadQuran(nextScript);
  handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah });
}

function handleRangeChange({ surah, fromAyah, toAyah }) {
  state.surah = surah;
  state.fromAyah = fromAyah;
  state.toAyah = toAyah;
  state.parsedVerses = [];
  const rawVerses = [];
  for (let a = fromAyah; a <= toAyah; a++) {
    const raw = getVerse(surah, a);
    rawVerses.push(raw);
    state.parsedVerses.push(parseVerse(raw));
  }
  state.cursor = { verseIdx: 0, wordIdx: 0 };
  state.session = {
    wordsWritten: 0,
    wordsTotal: state.parsedVerses.reduce((s, v) => s + v.length, 0),
    letterErrors: {}, diacriticErrors: {},
    letterErrorsTotal: 0, diacriticErrorsTotal: 0
  };
  verseDisplayApi.reset();
  verseDisplayApi.setRevealVerses(rawVerses);
  currentVerseLine = verseDisplayApi.startNewVerse();
  keypadApi.clearInput();
}

function handleSubmit(text) {
  const userItems = parseUserStream(text);
  if (userItems.filter(i => i.kind === 'letter').length === 0) return;

  const { annotations, newCursor, completedVerses, verseAlignments } =
    smartMatch(userItems, state.parsedVerses, state.cursor);

  // Append annotated user text to the current verse's user line. Crossing
  // verse boundaries within a single submit puts everything on the current
  // line; correction lines below still print per verse correctly.
  if (currentVerseLine) {
    currentVerseLine.appendUserStream(annotations);
  }

  // Record per-letter / per-diacritic errors.
  for (const [, verseMap] of verseAlignments.entries()) {
    for (const [, results] of verseMap.entries()) {
      for (const r of results) {
        if (r.letterMatch === 'wrong') {
          recordError({ kind: 'letter', value: r.expected.letter });
          bumpSession('letter', r.expected.letter);
        }
        if (r.diacriticMatch === 'wrong' || r.diacriticMatch === 'missing') {
          const d = r.expected.diacritics[0];
          if (d) { recordError({ kind: 'diacritic', value: d }); bumpSession('diacritic', d); }
        }
      }
    }
  }

  // Emit correction line for each completed verse, then start fresh user line.
  for (const vi of completedVerses) {
    const expectedVerse = state.parsedVerses[vi];
    const verseResults = verseAlignments.get(vi) || new Map();
    const byWord = new Map();
    for (let wi = 0; wi < expectedVerse.length; wi++) {
      byWord.set(wi, verseResults.get(wi) || []);
    }
    currentVerseLine.appendCorrectVerse(expectedVerse, byWord);
    state.session.wordsWritten += expectedVerse.length;
    if (vi < state.parsedVerses.length - 1) {
      currentVerseLine = verseDisplayApi.startNewVerse();
    }
  }

  state.cursor = newCursor;

  if (newCursor.verseIdx >= state.parsedVerses.length) {
    showSummary(document.body, {
      sessionStats: state.session,
      onPracticeAgain: () => handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah }),
      onPickNew: () => {
        const surahSel = document.querySelector('#header select.surah');
        if (surahSel) { surahSel.focus(); surahSel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      }
    });
  }
}

function bumpSession(kind, value) {
  const map = kind === 'letter' ? state.session.letterErrors : state.session.diacriticErrors;
  map[value] = (map[value] || 0) + 1;
  if (kind === 'letter') state.session.letterErrorsTotal++;
  else state.session.diacriticErrorsTotal++;
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
