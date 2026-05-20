import { loadQuran, getVerse } from './data/quran-loader.js';
import { getSurah } from './data/surah-metadata.js';
import { loadWordMeanings, getWordMeaning } from './data/word-meanings.js';
import { mountHeader } from './ui/header.js';
import { mountPracticeView } from './ui/practice-view.js';
import { mountKeypad } from './ui/keypad.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { mountMyBook } from './ui/my-book.js';
import { startRapidFire } from './ui/rapid-fire.js';
import { getSettings, updateSettings } from './store/settings.js';
import {
  recordError, recordAttempt, getAccuracy, getCoverage,
  markVerseComplete, markVerseSkipped, resetStats,
  getCompletedVerses
} from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';
import { chimeComplete } from './ui/feedback.js';

const state = {
  surah: 1, ayah: 1, surahMax: 7, surahName: 'Al-Fatiha',
  settings: null
};
const player = new AyahPlayer();
let practiceApi, keypadApi, headerApi;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
  state.settings = await getSettings();
  await Promise.all([
    loadQuran(state.settings.script),
    loadWordMeanings()
  ]);

  const headerEl   = document.getElementById('header');
  const practiceEl = document.getElementById('verse-display');
  const keypadEl   = document.getElementById('keypad-view');

  practiceApi = mountPracticeView(practiceEl, {
    onVerseComplete: handleVerseComplete,
    onPrevAyah:      handlePrevAyah
  });
  practiceApi.setMeaningLookup(getWordMeaning);

  keypadApi = mountKeypad(keypadEl, {
    onLetter:    handleLetter,
    onHarakat:   handleHarakat,
    onBackspace: handleBackspace,
    onPlayAudio: playCurrentAyah,
    onNextAyah:  handleNextAyah
  }, { script: state.settings.script });

  headerApi = mountHeader(headerEl, {
    initial: { surah: state.surah, fromAyah: state.ayah, toAyah: state.ayah, script: state.settings.script },
    onChange: handleRangeChange,
    onOpenSettings: openSettings,
    onScriptToggle: handleScriptToggle,
    onOpenBook: () => mountMyBook(document.body),
    onOpenRapidFire: openRapidFire
  });

  refreshHeaderStats();
}

async function refreshHeaderStats() {
  const [coverage, accuracy] = await Promise.all([getCoverage(), getAccuracy()]);
  headerApi.updateStats({ coverage, accuracy });
}

function refreshHints() {
  const m = practiceApi.getMatcher();
  if (!m) return keypadApi.setHint({});
  const policy = state.settings.hintPolicy;
  if (policy === 'none') return keypadApi.setHint({});

  const hint = m.nextHint();
  if (policy === 'always') {
    keypadApi.setHint(hint);
    return;
  }
  // policy === 'auto' — show hint only after 2 wrong attempts on current slot
  const rc = m.state.rejectCount;
  if (rc < 2) {
    keypadApi.setHint({});
    return;
  }
  const out = {};
  if (m.state.awaiting === 'letter' && hint.letter) out.letter = hint.letter;
  if (m.state.awaiting === 'harakat' && hint.harakat) out.harakat = hint.harakat;
  keypadApi.setHint(out);
}

function handleLetter(ch) {
  const m = practiceApi.getMatcher();
  if (!m) return;
  const r = m.tryLetter(ch);
  if (!r.accepted) {
    keypadApi.flashWrong(ch);
    const expected = m.skeleton[m.state.slotIdx]?.letter || ch;
    recordError({ kind: 'letter', value: expected });
    recordAttempt({ correct: false });
    practiceApi.noteWrongAttempt();
    refreshHints();
    return;
  }
  recordAttempt({ correct: true });
  practiceApi.applyKeyResult(r);
  refreshHints();
}

function handleHarakat(ch) {
  const m = practiceApi.getMatcher();
  if (!m) return;
  const r = m.tryHarakat(ch);
  if (!r.accepted) {
    keypadApi.flashWrong(ch);
    recordError({ kind: 'diacritic', value: ch });
    recordAttempt({ correct: false });
    practiceApi.noteWrongAttempt();
    refreshHints();
    return;
  }
  recordAttempt({ correct: true });
  practiceApi.applyKeyResult(r);
  refreshHints();
}

function handleBackspace() {
  const m = practiceApi.getMatcher();
  if (!m) return;
  m.backspace();
  practiceApi.applyKeyResult({ complete: false });
  refreshHints();
}

async function handlePrevAyah() {
  // If we're already in review, navigate further back; otherwise enter
  // review mode showing the previously-completed verse.
  const completed = await getCompletedVerses();
  // Find the most recent completed entry strictly before current (surah, ayah).
  const candidates = completed
    .filter(v => !v.skipped &&
      (v.surah < state.surah || (v.surah === state.surah && v.ayah < state.ayah)));
  if (candidates.length === 0) {
    // Nothing to show yet — gentle nudge.
    showRetryToast('No previously-written ayahs yet.', () => {});
    return;
  }
  const last = candidates[candidates.length - 1];
  practiceApi.showReview(last);
  // Reuse next-ayah handler to exit review and return to live verse.
  keypadApi.setHandlers({
    onLetter: () => {},
    onHarakat: () => {},
    onBackspace: exitReview,
    onPlayAudio: () => playAyah(last.surah, last.ayah),
    onNextAyah: exitReview
  });
}

function exitReview() {
  practiceApi.exitReview();
  keypadApi.setHandlers({
    onLetter:    handleLetter,
    onHarakat:   handleHarakat,
    onBackspace: handleBackspace,
    onPlayAudio: playCurrentAyah,
    onNextAyah:  handleNextAyah
  });
}

function playAyah(surah, ayah) {
  const url = buildAyahUrl(state.settings.reciter, surah, ayah);
  player.play(url).catch(() => {});
}

function handleNextAyah() {
  if (practiceApi.hasInProgressInput()) {
    const ok = window.confirm('Your writing for this ayah is incomplete. Skip to the next one?');
    if (!ok) return;
  }
  // Record a skip placeholder in My Book.
  try {
    const rt = getVerse(state.surah, state.ayah);
    markVerseSkipped({ surah: state.surah, ayah: state.ayah, rawText: rt })
      .catch(() => {});
  } catch {}
  advanceToNextAyah({ skipped: true });
}

function handleVerseComplete({ surah, ayah, rawText, perfect }) {
  chimeComplete();
  markVerseComplete({ surah, ayah, rawText, perfect })
    .then(() => refreshHeaderStats())
    .catch(err => console.warn('markVerseComplete failed:', err));
  advanceToNextAyah({ skipped: false });
}

function advanceToNextAyah({ slide = true } = {}) {
  const nextAyah = state.ayah + 1;
  if (nextAyah > state.surahMax) {
    practiceApi.showRangeEnd([
      { label: 'Practice this surah again', cls: 'primary',
        onClick: () => loadCurrentSurahFromStart() },
      { label: 'Pick another surah', cls: 'secondary',
        onClick: () => {
          const surahSel = document.querySelector('#header select.surah');
          if (surahSel) { surahSel.focus(); surahSel.scrollIntoView({ behavior: 'smooth' }); }
        } }
    ]);
    return;
  }
  state.ayah = nextAyah;
  loadCurrentVerse({ slide: true });
}

function loadCurrentSurahFromStart() {
  state.ayah = 1;
  loadCurrentVerse({ slide: true });
}

function loadCurrentVerse({ slide = false } = {}) {
  const rawText = getVerse(state.surah, state.ayah);
  practiceApi.setVerse({
    surah: state.surah,
    surahName: state.surahName,
    ayah: state.ayah,
    rawText,
    slide
  });
  refreshHints();
}

async function handleScriptToggle(nextScript) {
  state.settings = await updateSettings({ script: nextScript });
  await loadQuran(nextScript);
  if (keypadApi.setScript) keypadApi.setScript(nextScript);
  loadCurrentVerse();
}

function handleRangeChange({ surah, fromAyah }) {
  state.surah = surah;
  state.ayah = fromAyah;
  const meta = getSurah(surah);
  state.surahMax = meta?.verses || 1;
  state.surahName = meta?.name_en || `Surah ${surah}`;
  loadCurrentVerse();
}

function openSettings() {
  mountSettingsModal(document.body, {
    settings: state.settings,
    onChange: async (patch) => { state.settings = await updateSettings(patch); refreshHints(); },
    onResetStats: async () => { await resetStats(); refreshHeaderStats(); }
  });
}

async function openRapidFire() {
  const verseEl  = document.getElementById('verse-display');
  const keypadEl = document.getElementById('keypad-view');
  await startRapidFire({
    verseEl, keypadEl, keypadApi,
    reciter: state.settings.reciter,
    onExit: () => {
      // Restore normal handlers and re-render current verse.
      keypadApi.setHandlers({
        onLetter:    handleLetter,
        onHarakat:   handleHarakat,
        onBackspace: handleBackspace,
        onPlayAudio: playCurrentAyah,
        onNextAyah:  handleNextAyah
      });
      loadCurrentVerse();
    }
  });
}

function playCurrentAyah() {
  const url = buildAyahUrl(state.settings.reciter, state.surah, state.ayah);
  player.play(url).catch(() => showRetryToast('Could not load audio.', playCurrentAyah));
}

function showRetryToast(message, onRetry) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = 'toast';
  const text = document.createElement('span'); text.textContent = message + ' ';
  const retry = document.createElement('button');
  retry.textContent = 'Retry'; retry.className = 'toast-retry';
  retry.addEventListener('click', () => { toast.remove(); onRetry(); });
  const dismiss = document.createElement('button');
  dismiss.textContent = '×'; dismiss.className = 'toast-dismiss';
  dismiss.addEventListener('click', () => toast.remove());
  toast.append(text, retry, dismiss);
  document.body.appendChild(toast);
}

init().catch((err) => {
  console.error('Init failed:', err);
  showRetryToast('Failed to load app.', () => location.reload());
});
