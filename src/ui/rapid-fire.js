import { getCompletedVerses } from '../store/stats.js';
import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { buildAyahUrl, AyahPlayer } from '../audio/player.js';
import { getVerse } from '../data/quran-loader.js';
import { mountKeypad } from './keypad.js';

// Rapid fire: pick 3-5 verses (prefer ones the user got wrong before; else
// any completed verses; else fall back to Al-Fatiha 1-5). Play audio, user
// types, scored by perfect-attempt-rate.

const ROUND_SIZE = 3;

async function pickRound(reciter) {
  const completed = await getCompletedVerses();
  const pool = completed.length >= ROUND_SIZE
    ? completed
    : [];
  // Prefer non-perfect verses (user struggled with them).
  const struggled = pool.filter(v => !v.perfect);
  const easy = pool.filter(v => v.perfect);
  let picks = [];
  picks.push(...shuffle(struggled).slice(0, ROUND_SIZE));
  if (picks.length < ROUND_SIZE) {
    picks.push(...shuffle(easy).slice(0, ROUND_SIZE - picks.length));
  }
  if (picks.length < ROUND_SIZE) {
    // Fallback: Al-Fatiha verses 1..ROUND_SIZE
    for (let a = 1; picks.length < ROUND_SIZE && a <= 7; a++) {
      try {
        const rawText = getVerse(1, a);
        picks.push({ surah: 1, ayah: a, rawText });
      } catch {}
    }
  }
  return picks;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function mountRapidFire(root, { reciter = 'Alafasy_64kbps' } = {}) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const panel = document.createElement('div');
  panel.className = 'modal__panel rapid-fire__panel';
  modal.appendChild(panel);
  root.appendChild(modal);

  const head = document.createElement('div');
  head.className = 'rapid-fire__head';
  const h = document.createElement('h3');
  h.textContent = '🎯 Rapid fire';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', cleanup);
  head.append(h, closeBtn);

  const status = document.createElement('div');
  status.className = 'rapid-fire__status';

  const canon = document.createElement('div');
  canon.className = 'canonical-pane rapid-fire__canon';
  canon.style.minHeight = '2em';

  const user = document.createElement('div');
  user.className = 'user-pane rapid-fire__user';

  const playBar = document.createElement('div');
  playBar.className = 'rapid-fire__bar';
  const playBtn = document.createElement('button');
  playBtn.className = 'rapid-fire__play'; playBtn.textContent = '▶ play';
  const skipBtn = document.createElement('button');
  skipBtn.className = 'rapid-fire__skip'; skipBtn.textContent = 'Skip';
  playBar.append(playBtn, skipBtn);

  const kpRoot = document.createElement('div');
  kpRoot.className = 'rapid-fire__keypad';

  panel.append(head, status, canon, user, playBar, kpRoot);

  const player = new AyahPlayer();
  const picks = await pickRound(reciter);
  let idx = 0;
  let matcher = null;
  let perfectCount = 0;
  let attemptedCount = 0;
  let versePerfect = true;

  function render() {
    canon.innerHTML = '';
    user.innerHTML = '';
    if (!matcher) return;
    const skeleton = matcher.skeleton;
    for (let i = 0; i < skeleton.length; i++) {
      const slot = skeleton[i];
      if (slot.kind === 'wordEnd') { canon.appendChild(document.createTextNode(' ')); continue; }
      const sp = document.createElement('span');
      sp.textContent = slot.letter;
      const classes = ['canonical-slot'];
      if (slot.kind === 'silent') classes.push('canonical-slot--silent');
      const sealedUpTo = matcher.state.awaiting === 'harakat'
        ? matcher.state.slotIdx
        : matcher.state.slotIdx - 1;
      if (i <= sealedUpTo) classes.push('canonical-slot--sealed');
      else if (i === matcher.state.slotIdx && slot.kind === 'sound') classes.push('canonical-slot--current');
      else classes.push('canonical-slot--future');
      sp.className = classes.join(' ');
      canon.appendChild(sp);
    }
    for (const t of matcher.state.typed) {
      if (t.kind === 'wordEnd') { user.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.textContent = (t.letter || '') + (t.harakat || '');
      s.className = t.kind === 'silent' ? 'user-glyph silent' : 'user-glyph';
      user.appendChild(s);
    }
  }

  function startVerse() {
    if (idx >= picks.length) return finish();
    const v = picks[idx];
    status.textContent = `Verse ${idx + 1} of ${picks.length} · listen and write`;
    matcher = new LiveMatcher(buildSkeleton(v.rawText, { isVerseStart: true }));
    versePerfect = true;
    render();
    playCurrent();
  }

  function playCurrent() {
    const v = picks[idx];
    const url = buildAyahUrl(reciter, v.surah, v.ayah);
    player.play(url).catch(() => {});
  }

  function nextVerse(skipped) {
    if (!skipped) {
      attemptedCount++;
      if (versePerfect) perfectCount++;
    }
    idx++;
    if (idx >= picks.length) finish();
    else startVerse();
  }

  function finish() {
    matcher = null;
    canon.textContent = '';
    user.textContent = '';
    const score = attemptedCount === 0 ? 0
      : Math.round((perfectCount / attemptedCount) * 100);
    status.innerHTML = '';
    const big = document.createElement('div');
    big.className = 'rapid-fire__score';
    big.textContent = `Score: ${score}%`;
    const detail = document.createElement('div');
    detail.className = 'rapid-fire__detail';
    detail.textContent = `${perfectCount} of ${attemptedCount} attempted verses written without mistakes.`;
    status.append(big, detail);
    playBtn.style.display = 'none';
    skipBtn.textContent = 'Done';
    skipBtn.onclick = cleanup;
  }

  playBtn.addEventListener('click', playCurrent);
  skipBtn.addEventListener('click', () => nextVerse(true));

  const kp = mountKeypad(kpRoot, {
    onLetter: (ch) => {
      if (!matcher) return;
      const r = matcher.tryLetter(ch);
      if (!r.accepted) { versePerfect = false; kp.flashWrong(ch); }
      render();
      if (r.complete) nextVerse(false);
    },
    onHarakat: (ch) => {
      if (!matcher) return;
      const r = matcher.tryHarakat(ch);
      if (!r.accepted) { versePerfect = false; kp.flashWrong(ch); }
      render();
      if (r.complete) nextVerse(false);
    },
    onBackspace: () => { if (matcher) { matcher.backspace(); render(); } },
    onPlayAudio: playCurrent,
    onNextAyah: () => nextVerse(true)
  });

  function cleanup() {
    player.stop();
    modal.remove();
  }

  startVerse();
}
