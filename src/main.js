import { loadQuran, getVerse } from './data/quran-loader.js';
import { parseVerse } from './verse/parser.js';
import { mountHeader } from './ui/header.js';
import { mountVerseDisplay } from './ui/verse-display.js';
import { mountCanvasView } from './ui/canvas-view.js';
import { mountSettingsModal } from './ui/settings-modal.js';
import { showSummary } from './ui/summary.js';
import { segment } from './canvas/segmenter.js';
import { classifyClusters } from './recognition/classifier.js';
import { classifyDiacritic } from './recognition/diacritic-detector.js';
import { align } from './compare/aligner.js';
import { getSettings, updateSettings } from './store/settings.js';
import { recordError, resetStats } from './store/stats.js';
import { AyahPlayer, buildAyahUrl } from './audio/player.js';

const state = {
  surah: 1, fromAyah: 1, toAyah: 1,
  parsedVerses: [],
  cursor: { verseIdx: 0, wordIdx: 0 },
  history: [],
  settings: null,
  session: { wordsWritten: 0, wordsTotal: 0, letterErrors: {}, diacriticErrors: {}, letterErrorsTotal: 0, diacriticErrorsTotal: 0 }
};

const player = new AyahPlayer();
let verseDisplayApi = null;
let canvasViewApi = null;
let currentVerseLine = null;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
  await loadQuran();
  state.settings = await getSettings();

  const headerEl = document.getElementById('header');
  const verseEl  = document.getElementById('verse-display');
  const canvasEl = document.getElementById('canvas-view');

  verseDisplayApi = mountVerseDisplay(verseEl, { onPlayVerse: playCurrentVerse });
  canvasViewApi = mountCanvasView(canvasEl, {
    onCommit: handleCommit,
    strokeColor: state.settings.strokeColor,
    strokeWidth: state.settings.strokeWidth
  });
  canvasViewApi.onUndoClick(handleUndo);

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
  state.session = {
    wordsWritten: 0,
    wordsTotal: state.parsedVerses.reduce((s, v) => s + v.length, 0),
    letterErrors: {}, diacriticErrors: {},
    letterErrorsTotal: 0, diacriticErrorsTotal: 0
  };
  canvasViewApi?.clear();
  verseDisplayApi.reset();
  currentVerseLine = verseDisplayApi.startNewVerse();
}

function handleCommit(committedStrokes, canvasMeta) {
  const word = currentExpectedWord();
  if (!word) return;
  const userExpected = word.filter(g => !g.isSilent);
  const expectedLetters = userExpected.map(g => g.letter);

  const seg = segment(committedStrokes, canvasMeta);
  const letters = classifyClusters(seg.clusters, expectedLetters);
  const allDiacritics = seg.clusters.flatMap(c => c.diacritics);
  const diacritics = classifyDiacritic(allDiacritics);

  const alignment = align(word, { letters, diacritics });

  const renderedWord = currentVerseLine.appendWord(alignment, { silentColorOn: state.settings.silentLetterColorOn });
  state.history.push({ verseIdx: state.cursor.verseIdx, wordIdx: state.cursor.wordIdx, rendered: renderedWord });

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

  advanceCursor();
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

function handleUndo() {
  const last = state.history.pop();
  if (!last) return;
  if (last.rendered && last.rendered.remove) last.rendered.remove();
  // Decrement session counters for the undone word
  state.session.wordsWritten = Math.max(0, state.session.wordsWritten - 1);
  state.cursor = { verseIdx: last.verseIdx, wordIdx: last.wordIdx };
  // Also bring back commit hint visibility — see fix 3
  const hint = document.querySelector('#canvas-view .commit-hint');
  if (hint) hint.style.display = '';
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
  player.play(url).catch(() => {
    showRetryToast('Could not load audio.', playCurrentVerse);
  });
}

function showRetryToast(message, onRetry) {
  // Remove any existing toast first.
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
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = 'Failed to load app. Reload to retry.';
  document.body.appendChild(t);
});
