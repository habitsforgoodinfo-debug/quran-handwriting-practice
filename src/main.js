import { loadQuran, getVerse } from './data/quran-loader.js';
import { getSurah } from './data/surah-metadata.js';
import { mountHeader } from './ui/header.js';
import { mountPracticeView } from './ui/practice-view.js';
import { mountKeypad } from './ui/keypad.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { mountMyBook } from './ui/my-book.js';
import { mountIntro } from './ui/intro.js';
import { pickRapidFireChallenge } from './ui/rapid-fire.js';
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
  await loadQuran(state.settings.script);

  const headerEl   = document.getElementById('header');
  const practiceEl = document.getElementById('verse-display');
  const keypadEl   = document.getElementById('keypad-view');

  practiceApi = mountPracticeView(practiceEl, {
    onVerseComplete: handleVerseComplete
  });

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
    onOpenRapidFire: openRapidFire,
    onPrevAyah: handlePrevAyah,
    onNextReviewAyah: handleNextReviewAyah
  });

  refreshHeaderStats();

  if (!state.settings.hideIntro) {
    mountIntro(document.body, {
      onHide: async () => { state.settings = await updateSettings({ hideIntro: true }); }
    });
  }
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

// Review navigation. When user presses ← in the header, we step back
// through the list of completed verses. Each subsequent ← goes further
// back. → goes forward, ending at the live ayah (state.surah, state.ayah).
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
  headerApi.setReviewMode(true);
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
  headerApi.setReviewMode(false);
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

function loadCurrentVerse({ slide = false, autoPlay = false } = {}) {
  const rawText = getVerse(state.surah, state.ayah);
  practiceApi.setVerse({
    surah: state.surah,
    surahName: state.surahName,
    ayah: state.ayah,
    rawText,
    slide
  });
  refreshHints();
  if (autoPlay || state.settings.autoPlayOnAyahLoad) {
    setTimeout(() => playAyah(state.surah, state.ayah), 350);
  }
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
  const challenge = await pickRapidFireChallenge();
  if (!challenge) {
    showRetryToast('No rapid-fire challenges yet — write some verses first.', () => {});
    return;
  }
  // Jump to the challenge verse using the normal canvas, then play its audio
  // once so the user hears what they have to write.
  const meta = getSurah(challenge.surah);
  state.surah = challenge.surah;
  state.ayah  = challenge.ayah;
  state.surahMax  = meta?.verses || 1;
  state.surahName = meta?.name_en || `Surah ${challenge.surah}`;
  loadCurrentVerse({ slide: true });
  setTimeout(() => playAyah(challenge.surah, challenge.ayah), 350);
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
