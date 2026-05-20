import { getCompletedVerses } from '../store/stats.js';
import { buildSkeleton } from '../verse/skeleton.js';
import { LiveMatcher } from '../compare/live-matcher.js';
import { buildAyahUrl, AyahPlayer } from '../audio/player.js';
import { getVerse } from '../data/quran-loader.js';
import { _diacriticCharByName as CHAR_BY_NAME } from '../verse/parser.js';

const ROUND_SIZE = 3;

async function pickRound() {
  const completed = await getCompletedVerses();
  const usable = completed.filter(v => !v.skipped);
  const struggled = usable.filter(v => !v.perfect);
  const easy      = usable.filter(v =>  v.perfect);
  const picks = [...shuffle(struggled).slice(0, ROUND_SIZE)];
  if (picks.length < ROUND_SIZE) picks.push(...shuffle(easy).slice(0, ROUND_SIZE - picks.length));
  if (picks.length < ROUND_SIZE) {
    for (let a = 1; picks.length < ROUND_SIZE && a <= 7; a++) {
      try { picks.push({ surah: 1, ayah: a, rawText: getVerse(1, a) }); } catch {}
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

// Inline rapid-fire: takes over the verseEl/keypadEl in place, restores
// the prior view on close via the supplied callbacks.
//
// Required deps:
//   verseEl, keypadEl   — the DOM containers to repaint
//   keypadApi           — used for setHint/flashWrong & to install new
//                         handlers (we mount fresh handlers here)
//   onExit              — called when user is done; main re-renders the
//                         normal practice view + restores keypad handlers
//   reciter             — string id
export async function startRapidFire({ verseEl, keypadEl, keypadApi, reciter, onExit }) {
  const player = new AyahPlayer();
  const picks = await pickRound();

  // Hide the practice view but keep its DOM intact so we can restore on exit.
  const practiceChildren = Array.from(verseEl.children);
  for (const c of practiceChildren) c.style.display = 'none';

  const wrap = document.createElement('div');
  wrap.className = 'rapid-fire-inline';

  const head = document.createElement('div'); head.className = 'rf-head';
  const title = document.createElement('div'); title.className = 'rf-title';
  title.textContent = '🎧 Listen & write — rapid round';
  const exitBtn = document.createElement('button'); exitBtn.className = 'rf-exit';
  exitBtn.textContent = '× exit';
  exitBtn.addEventListener('click', finish);
  head.append(title, exitBtn);

  const status = document.createElement('div'); status.className = 'rf-status';

  const canon = document.createElement('div'); canon.className = 'canonical-pane rf-canon';
  const user  = document.createElement('div'); user.className = 'user-pane rf-user';

  const bar = document.createElement('div'); bar.className = 'rf-bar';
  const playBtn = document.createElement('button'); playBtn.className = 'rf-play'; playBtn.textContent = '▶ play';
  const skipBtn = document.createElement('button'); skipBtn.className = 'rf-skip'; skipBtn.textContent = 'Skip verse';
  bar.append(playBtn, skipBtn);

  wrap.append(head, status, canon, user, bar);
  verseEl.appendChild(wrap);

  let idx = 0;
  let matcher = null;
  let perfectCount = 0;
  let attemptedCount = 0;
  let versePerfect = true;

  function render() {
    canon.innerHTML = '';
    user.innerHTML = '';
    if (!matcher) return;
    const sk = matcher.skeleton;
    for (let i = 0; i < sk.length; i++) {
      const slot = sk[i];
      if (slot.kind === 'wordEnd') { canon.appendChild(document.createTextNode(' ')); continue; }
      const sp = document.createElement('span');
      const ornaments = (slot.expectedHarakat?.ornaments || [])
        .map(n => CHAR_BY_NAME[n]).filter(Boolean).join('');
      sp.textContent = slot.letter + ornaments;
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
    if (idx >= picks.length) return showScore();
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
    if (idx >= picks.length) showScore();
    else startVerse();
  }

  function showScore() {
    matcher = null;
    canon.textContent = '';
    user.textContent = '';
    const score = attemptedCount === 0 ? 0 : Math.round((perfectCount / attemptedCount) * 100);
    status.innerHTML = '';
    const big = document.createElement('div'); big.className = 'rf-score'; big.textContent = `Score: ${score}%`;
    const detail = document.createElement('div'); detail.className = 'rf-detail';
    detail.textContent = `${perfectCount} of ${attemptedCount} attempted verses written without mistakes.`;
    status.append(big, detail);
    playBtn.style.display = 'none';
    skipBtn.textContent = 'Back to practice';
    skipBtn.onclick = finish;
  }

  function finish() {
    player.stop();
    wrap.remove();
    for (const c of practiceChildren) c.style.display = '';
    onExit && onExit();
  }

  playBtn.addEventListener('click', playCurrent);
  skipBtn.addEventListener('click', () => nextVerse(true));

  // Install rapid-fire-specific handlers on the existing keypad (it stays).
  keypadApi.setHandlers({
    onLetter: (ch) => {
      if (!matcher) return;
      const r = matcher.tryLetter(ch);
      if (!r.accepted) { versePerfect = false; keypadApi.flashWrong(ch); }
      render();
      if (r.complete) setTimeout(() => nextVerse(false), 400);
    },
    onHarakat: (ch) => {
      if (!matcher) return;
      const r = matcher.tryHarakat(ch);
      if (!r.accepted) { versePerfect = false; keypadApi.flashWrong(ch); }
      render();
      if (r.complete) setTimeout(() => nextVerse(false), 400);
    },
    onBackspace: () => { if (matcher) { matcher.backspace(); render(); } },
    onPlayAudio: playCurrent,
    onNextAyah: () => nextVerse(true)
  });

  startVerse();
}
