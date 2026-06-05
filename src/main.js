import { loadQuran, getVerse } from './data/quran-loader.js';
import { getSurah } from './data/surah-metadata.js';
import { mountPracticeView } from './ui/practice-view.js';
import { mountKeypad } from './ui/keypad.js';
import { mountRollingStrip } from './ui/rolling-strip.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { mountNavigator } from './ui/navigator.js';
import { mountWelcome } from './ui/screens/welcome.js';
import { mountSurahGrid } from './ui/screens/surah-grid.js';
import { mountDrawer } from './ui/drawer.js';
import { mountCelebration } from './ui/celebration.js';
import { starsFor } from './stats/stars.js';
import { resolveModeConfig, MODE_PRESETS } from './modes/presets.js';
import { getLastPosition, setLastPosition } from './store/session.js';
import { getSettings, updateSettings } from './store/settings.js';
import {
  recordError, recordAttempt,
  getAllSurahAccuracy,
  markVerseComplete, markVerseSkipped, resetStats,
  getCompletedVerses
} from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';
import { chimeComplete } from './ui/feedback.js';

const state = {
  surah: 1, ayah: 1, surahMax: 7, surahName: 'Al-Fatiha',
  mode: null,
  // matcherConfig is the active mode overlay. Null means "fall back to the
  // user's settings-derived required letters/harakat" (used after a settings
  // edit changes them for the rest of the session).
  matcherConfig: null,
  settings: null
};
const player = new AyahPlayer();
let practiceApi, keypadApi, rollingApi, nav, welcomeApi, gridApi, celebrationApi;

// Tracks which surah the rolling strip currently holds verses for, so we
// can clear it when the user switches to a different surah.
let rollingStripSurah = null;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
  state.settings = await getSettings();
  await loadQuran(state.settings.script);

  nav = mountNavigator(document.getElementById('cards'), {
    onChange: (name) => {
      if (name === 'welcome') refreshResume().catch(() => {});
      if (name === 'surahs') refreshGridStats().catch(() => {});
    }
  });

  // --- Welcome card ---
  const welcomeEl = document.createElement('div');
  nav.register('welcome', welcomeEl);
  welcomeApi = mountWelcome(welcomeEl, {
    onPickMode: (mode) => {
      state.mode = mode;
      state.matcherConfig = resolveModeConfig(mode, state.settings);
      nav.go('surahs');
    },
    onResume: () => resumeLast()
  });

  // --- Surahs card ---
  const surahsEl = document.createElement('div');
  nav.register('surahs', surahsEl);
  gridApi = mountSurahGrid(surahsEl, {
    onPick: ({ surah, ayah }) => startSurah({ surah, ayah }),
    onBack: () => nav.back()
  });

  // --- Canvas card ---
  const canvasEl = document.createElement('div');
  canvasEl.className = 'canvas';
  nav.register('canvas', canvasEl);

  const practiceEl = document.createElement('div');
  const rollingEl  = document.createElement('div');
  const keypadEl   = document.createElement('div');
  keypadEl.className = 'keypad-view';
  canvasEl.append(practiceEl, rollingEl, keypadEl);

  practiceApi = mountPracticeView(practiceEl, {
    onVerseComplete: handleVerseComplete,
    showTranslit: false
  });

  // Rolling strip starts empty every session — it shows only the verses
  // the user writes during the current sitting.
  rollingApi = mountRollingStrip(rollingEl);

  keypadApi = mountKeypad(keypadEl, {
    onLetter:    handleLetter,
    onHarakat:   handleHarakat,
    onBackspace: handleBackspace,
    onPlayAudio: playCurrentAyah,
    onNextAyah:  handleNextAyah
  }, { script: state.settings.script, showAudio: false });

  mountDrawer(canvasEl, {
    onOpenSettings: openSettings,
    onBackToSurahs: () => nav.go('surahs')
  });

  // Surah-completion celebration overlay (mounted once, shown on demand).
  celebrationApi = mountCelebration(document.body);

  // Land on welcome and surface the resume affordance if a last position
  // exists. refreshResume() also fires via onChange whenever welcome is
  // re-activated, so the label stays current after returning from practice.
  nav.go('welcome');
}

async function refreshResume() {
  const last = await getLastPosition();
  if (last && last.mode in MODE_PRESETS) {
    const meta = getSurah(last.surah);
    const name = meta?.name_en || `Surah ${last.surah}`;
    welcomeApi.setResume(`Resume - ${name}, ayah ${last.ayah}`);
  } else {
    welcomeApi.setResume(null);
  }
}

// Derive per-surah progress from completed (non-skipped) verse records.
// lastAyah is the next unwritten ayah = highest completed + 1, capped at the
// surah's ayah count, so "Continue from ayah N" lands on the next gap.
async function buildProgressBySurah() {
  const completed = await getCompletedVerses();
  const map = {};
  for (const v of completed) {
    if (!v || v.skipped) continue;
    const entry = map[v.surah] || { written: 0, maxAyah: 0 };
    entry.written++;
    if (v.ayah > entry.maxAyah) entry.maxAyah = v.ayah;
    map[v.surah] = entry;
  }
  const out = {};
  for (const [surah, entry] of Object.entries(map)) {
    const meta = getSurah(Number(surah));
    const verses = meta?.verses || entry.maxAyah;
    out[surah] = {
      written: entry.written,
      lastAyah: Math.min(entry.maxAyah + 1, verses)
    };
  }
  return out;
}

async function refreshGridStats() {
  const [accMap, progressBySurah] = await Promise.all([
    getAllSurahAccuracy(),
    buildProgressBySurah()
  ]);
  gridApi.refreshStats({ accMap, progressBySurah });
}

function startSurah({ surah, ayah }) {
  const meta = getSurah(surah);
  state.surah = surah;
  state.ayah  = ayah;
  state.surahMax  = meta?.verses || 1;
  state.surahName = meta?.name_en || `Surah ${surah}`;
  if (rollingApi && surah !== rollingStripSurah) {
    rollingApi.clear();
    rollingStripSurah = surah;
  }
  nav.go('canvas');
  loadCurrentVerse({ autoPlay: state.matcherConfig?.isDictation });
}

async function resumeLast() {
  const last = await getLastPosition();
  if (!last || !(last.mode in MODE_PRESETS)) return;
  state.mode = last.mode;
  state.matcherConfig = resolveModeConfig(last.mode, state.settings);
  const meta = getSurah(last.surah);
  const verses = meta?.verses || 1;
  state.surah = last.surah;
  state.surahMax  = verses;
  state.surahName = meta?.name_en || `Surah ${last.surah}`;
  state.ayah = Math.min(Math.max(1, last.ayah), verses);
  if (rollingApi && last.surah !== rollingStripSurah) {
    rollingApi.clear();
    rollingStripSurah = last.surah;
  }
  nav.go('canvas');
  loadCurrentVerse({ autoPlay: state.matcherConfig?.isDictation });
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
    recordAttempt({ correct: false, surah: state.surah });
    practiceApi.noteWrongAttempt();
    refreshHints();
    return;
  }
  recordAttempt({ correct: true, surah: state.surah });
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
    recordAttempt({ correct: false, surah: state.surah });
    practiceApi.noteWrongAttempt();
    refreshHints();
    return;
  }
  recordAttempt({ correct: true, surah: state.surah });
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

// Review navigation. Kept for a later phase; no longer wired now that the
// header (which triggered it) is gone. References headerApi lazily so it does
// not throw at module load.
let reviewPointer = null; // { surah, ayah } currently shown in review mode

async function handlePrevAyah() {
  const completed = await getCompletedVerses();
  const sorted = completed.filter(v => !v.skipped)
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  if (sorted.length === 0) {
    showRetryToast('No previously-written ayahs yet.', () => {});
    return;
  }
  // Find the verse strictly before the currently-displayed (review or live).
  const cur = reviewPointer || { surah: state.surah, ayah: state.ayah };
  const candidates = sorted.filter(v =>
    v.surah < cur.surah || (v.surah === cur.surah && v.ayah < cur.ayah));
  if (candidates.length === 0) {
    showRetryToast('You are at the earliest written ayah.', () => {});
    return;
  }
  const target = candidates[candidates.length - 1];
  reviewPointer = { surah: target.surah, ayah: target.ayah };
  enterReview(target);
}

async function handleNextReviewAyah() {
  if (!reviewPointer) return;
  const completed = await getCompletedVerses();
  const sorted = completed.filter(v => !v.skipped)
    .sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  const liveCur = { surah: state.surah, ayah: state.ayah };
  const ahead = sorted.filter(v =>
    (v.surah > reviewPointer.surah || (v.surah === reviewPointer.surah && v.ayah > reviewPointer.ayah)) &&
    (v.surah < liveCur.surah || (v.surah === liveCur.surah && v.ayah < liveCur.ayah)));
  if (ahead.length > 0) {
    const target = ahead[0];
    reviewPointer = { surah: target.surah, ayah: target.ayah };
    enterReview(target);
    return;
  }
  // No further review entry; back to live.
  exitReview();
}

function enterReview(verse) {
  practiceApi.showReview(verse);
  keypadApi.setHandlers({
    onLetter: () => {},
    onHarakat: () => {},
    onBackspace: exitReview,
    onPlayAudio: () => playAyah(verse.surah, verse.ayah),
    onNextAyah: exitReview
  });
}

function exitReview() {
  reviewPointer = null;
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
  advanceToNextAyah();
}

const BATCH_SIZE = 20;
const batchState = {
  count: 0,
  mistakes: [],            // [{ surah, ayah, rawText }]
  inRetryMode: false,
  retryQueue: [],
  resumeSurah: null,
  resumeAyah: null
};

async function handleVerseComplete({ surah, ayah, rawText, perfect }) {
  chimeComplete();
  rollingApi?.pushVerse(rawText);
  // Await the write so downstream reads (surah stars/celebration) see this
  // verse as recorded. The completion handler is fired-and-forgotten from a
  // timer, so awaiting here is safe.
  await markVerseComplete({ surah, ayah, rawText, perfect })
    .catch(err => console.warn('markVerseComplete failed:', err));

  if (batchState.inRetryMode) {
    advanceRetryQueue();
    return;
  }

  batchState.count++;
  if (!perfect) batchState.mistakes.push({ surah, ayah, rawText });

  if (state.settings.quickTestEvery20 && batchState.count >= BATCH_SIZE) {
    if (batchState.mistakes.length > 0) {
      promptBatchRetry();
      return;
    }
    batchState.count = 0;
    batchState.mistakes = [];
  }

  advanceToNextAyah();
}

function promptBatchRetry() {
  const n = batchState.mistakes.length;
  practiceApi.showPrompt(
    `Quick check — you slipped on ${n} of the last ${BATCH_SIZE} verses. Want to retry them now?`,
    [
      { label: `Retry ${n} verses`, cls: 'primary',  onClick: startRetry },
      { label: 'Skip',               cls: 'secondary', onClick: skipRetry }
    ]
  );
}

function startRetry() {
  batchState.inRetryMode = true;
  batchState.retryQueue = [...batchState.mistakes];
  // Remember where to resume after retries are done.
  const nextAyah = state.ayah + 1;
  if (nextAyah > state.surahMax) {
    batchState.resumeSurah = state.surah;
    batchState.resumeAyah  = state.surahMax; // surah will surface its end banner
  } else {
    batchState.resumeSurah = state.surah;
    batchState.resumeAyah  = nextAyah;
  }
  loadNextRetry();
}

function loadNextRetry() {
  const next = batchState.retryQueue.shift();
  if (!next) { exitRetryFlow(); return; }
  jumpToVerse(next.surah, next.ayah);
}

function advanceRetryQueue() {
  if (batchState.retryQueue.length === 0) {
    exitRetryFlow();
    return;
  }
  loadNextRetry();
}

function skipRetry() {
  batchState.count = 0;
  batchState.mistakes = [];
  advanceToNextAyah();
}

function exitRetryFlow() {
  batchState.inRetryMode = false;
  batchState.retryQueue = [];
  batchState.count = 0;
  batchState.mistakes = [];
  if (batchState.resumeSurah != null) {
    const s = batchState.resumeSurah, a = batchState.resumeAyah;
    batchState.resumeSurah = batchState.resumeAyah = null;
    jumpToVerse(s, a);
  }
}

function jumpToVerse(surah, ayah, slide = true) {
  const meta = getSurah(surah);
  state.surah = surah;
  state.ayah  = ayah;
  state.surahMax  = meta?.verses || 1;
  state.surahName = meta?.name_en || `Surah ${surah}`;
  if (rollingApi && surah !== rollingStripSurah) {
    rollingApi.clear();
    rollingStripSurah = surah;
  }
  loadCurrentVerse({ slide, autoPlay: state.matcherConfig?.isDictation });
}

function advanceToNextAyah({ slide = true } = {}) {
  const nextAyah = state.ayah + 1;
  if (nextAyah > state.surahMax) {
    const finishedSurah = state.surah;
    const finishedName = state.surahName;
    showRangeEndBanner();
    // Celebrate over the banner once the surah's stars are known.
    celebrateSurah(finishedSurah, finishedName).catch(() => {});
    return;
  }
  state.ayah = nextAyah;
  loadCurrentVerse({ slide: true, autoPlay: state.matcherConfig?.isDictation });
}

function showRangeEndBanner() {
  practiceApi.showRangeEnd([
    { label: 'Practice this surah again', cls: 'primary',
      onClick: () => loadCurrentSurahFromStart() },
    { label: 'Pick another surah', cls: 'secondary',
      onClick: () => nav.go('surahs') }
  ]);
}

// Compute stars for a just-finished surah from stored stats and pop the
// celebration overlay above the banner. Only celebrates when the surah is
// actually fully written (starsFor returns >= 1).
async function celebrateSurah(surah, surahName) {
  if (!celebrationApi) return;
  const [accMap, progressBySurah] = await Promise.all([
    getAllSurahAccuracy(),
    buildProgressBySurah()
  ]);
  const meta = getSurah(surah);
  const total = meta?.verses || 1;
  const prog = progressBySurah?.[surah] || progressBySurah?.[String(surah)];
  const written = prog?.written ?? 0;
  const acc = accMap?.[String(surah)];
  const pct = (acc && acc.attempts > 0)
    ? Math.round((acc.hits / acc.attempts) * 100)
    : 0;
  const stars = starsFor({ written, total, accuracyPct: pct });
  if (stars <= 0) return;
  celebrationApi.show({ surahName, stars });
}

function loadCurrentSurahFromStart() {
  state.ayah = 1;
  loadCurrentVerse({ slide: true, autoPlay: state.matcherConfig?.isDictation });
}

function loadCurrentVerse({ slide = false, autoPlay = false } = {}) {
  const rawText = getVerse(state.surah, state.ayah);
  // Mode overlay takes precedence; null overlay falls back to settings.
  const requiredLetters = state.matcherConfig
    ? state.matcherConfig.requiredLetters
    : (state.settings.requiredLetters || null);
  const requiredHarakat = state.matcherConfig
    ? state.matcherConfig.requiredHarakat
    : (state.settings.requiredHarakat || null);
  practiceApi.setVerse({
    surah: state.surah,
    surahName: state.surahName,
    ayah: state.ayah,
    rawText,
    slide,
    requiredLetters,
    requiredHarakat
  });
  refreshHints();
  // Show replay button only in dictation mode.
  practiceApi.setReplay(
    state.matcherConfig?.isDictation ? playCurrentAyah : null
  );
  // Single choke point for persisting where the user is.
  setLastPosition({ surah: state.surah, ayah: state.ayah, mode: state.mode })
    .catch(() => {});
  if (autoPlay || state.settings.autoPlayOnAyahLoad) {
    setTimeout(() => playAyah(state.surah, state.ayah), 350);
  }
}

function openSettings() {
  mountSettingsModal(document.body, {
    settings: state.settings,
    onChange: async (patch) => {
      state.settings = await updateSettings(patch);
      // A change to the required letters/harakat overrides the mode overlay
      // for the rest of the session.
      if ('requiredLetters' in patch || 'requiredHarakat' in patch) {
        state.matcherConfig = null;
        loadCurrentVerse();
      }
      refreshHints();
    },
    onResetStats: async () => { await resetStats(); refreshGridStats(); }
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
