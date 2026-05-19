import { loadQuran, getVerse } from './data/quran-loader.js';
import { mountHeader } from './ui/header.js';
import { mountPracticeView } from './ui/practice-view.js';
import { mountKeypad } from './ui/keypad.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { getSettings, updateSettings } from './store/settings.js';
import { recordError, getWorst, resetStats } from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';

const state = {
  surah: 1, fromAyah: 1, toAyah: 1,
  settings: null
};
const player = new AyahPlayer();
let practiceApi, keypadApi;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
  state.settings = await getSettings();
  await loadQuran(state.settings.script);

  const headerEl   = document.getElementById('header');
  const practiceEl = document.getElementById('verse-display');
  const keypadEl   = document.getElementById('keypad-view');

  practiceApi = mountPracticeView(practiceEl, { onAllVersesComplete: () => {} });

  keypadApi = mountKeypad(keypadEl, {
    onLetter:    handleLetter,
    onHarakat:   handleHarakat,
    onBackspace: handleBackspace,
    onPlayAudio: playCurrentVerse,
    onNextAyah:  handleNextAyah
  });

  mountHeader(headerEl, {
    initial: { surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah, script: state.settings.script },
    onChange: handleRangeChange,
    onOpenSettings: openSettings,
    onScriptToggle: handleScriptToggle
  });

  handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah });
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
  // policy === 'auto'
  const rc = m.state.rejectCount;
  if (rc === 0) {
    keypadApi.setHint({});
    return;
  }
  const out = {};
  if (m.state.awaiting === 'letter' && hint.letter) out.letter = hint.letter;
  if (m.state.awaiting === 'harakat' && hint.harakat) out.harakat = hint.harakat;
  keypadApi.setHint(out);
}

async function refreshHeatmap() {
  practiceApi.refreshHeatmap(await getWorst(3));
}

function handleLetter(ch) {
  const m = practiceApi.getMatcher();
  if (!m) return;
  const r = m.tryLetter(ch);
  if (!r.accepted) {
    keypadApi.flashWrong(ch);
    const expected = m.skeleton[m.state.slotIdx]?.letter || ch;
    recordError({ kind: 'letter', value: expected });
    refreshHeatmap();
    return;
  }
  practiceApi.applyKeyResult(r);
  refreshHints();
  if (r.complete) refreshHeatmap();
}

function handleHarakat(ch) {
  const m = practiceApi.getMatcher();
  if (!m) return;
  const r = m.tryHarakat(ch);
  if (!r.accepted) {
    keypadApi.flashWrong(ch);
    recordError({ kind: 'diacritic', value: ch });
    refreshHeatmap();
    return;
  }
  practiceApi.applyKeyResult(r);
  refreshHints();
  if (r.complete) refreshHeatmap();
}

function handleBackspace() {
  const m = practiceApi.getMatcher();
  if (!m) return;
  m.backspace();
  practiceApi.applyKeyResult({ complete: false });
  refreshHints();
}

function handleNextAyah() {
  practiceApi.advance({ skipped: true });
  refreshHints();
}

async function handleScriptToggle(nextScript) {
  state.settings = await updateSettings({ script: nextScript });
  await loadQuran(nextScript);
  handleRangeChange({ surah: state.surah, fromAyah: state.fromAyah, toAyah: state.toAyah });
}

function handleRangeChange({ surah, fromAyah, toAyah }) {
  state.surah = surah; state.fromAyah = fromAyah; state.toAyah = toAyah;
  const verses = [];
  for (let a = fromAyah; a <= toAyah; a++) verses.push(getVerse(surah, a));
  practiceApi.setVerses(verses);
  refreshHints();
  refreshHeatmap();
}

function openSettings() {
  mountSettingsModal(document.body, {
    settings: state.settings,
    onChange: async (patch) => { state.settings = await updateSettings(patch); refreshHints(); },
    onResetStats: async () => { await resetStats(); refreshHeatmap(); }
  });
}

function playCurrentVerse() {
  const url = buildAyahUrl(state.settings.reciter, state.surah, state.fromAyah);
  player.play(url).catch(() => showRetryToast('Could not load audio.', playCurrentVerse));
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
