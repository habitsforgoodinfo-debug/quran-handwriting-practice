// Surah-completion celebration overlay. Mount once; call show({ surahName,
// stars, onDismiss }) when a surah is finished. CSS-only star/confetti pop.
//
// Self-contained: builds its own DOM, sits above the canvas via z-index, and
// hides itself on dismiss (after invoking the supplied continue callback).

const PRAISE = [
  'Mashallah!',
  'Allahu Akbar!',
  'Subhanallah!',
  'Barakallahu feek!'
];

export function mountCelebration(parent = document.body) {
  const scrim = document.createElement('div');
  scrim.className = 'celebrate-scrim';
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-modal', 'true');
  scrim.style.display = 'none';

  const panel = document.createElement('div');
  panel.className = 'celebrate-panel';

  const confetti = document.createElement('div');
  confetti.className = 'celebrate-confetti';
  // A handful of CSS-driven confetti pieces in the vibrant palette.
  const COLORS = ['var(--c-green)', 'var(--c-sky)', 'var(--c-amber)', 'var(--c-coral)', 'var(--c-teal)'];
  for (let i = 0; i < 14; i++) {
    const piece = document.createElement('span');
    piece.className = 'celebrate-confetti__piece';
    piece.style.left = `${(i / 14) * 100}%`;
    piece.style.background = COLORS[i % COLORS.length];
    piece.style.animationDelay = `${(i % 7) * 70}ms`;
    confetti.appendChild(piece);
  }

  const starsRow = document.createElement('div');
  starsRow.className = 'celebrate-stars';

  const praiseEl = document.createElement('div');
  praiseEl.className = 'celebrate-praise';

  const lineEl = document.createElement('div');
  lineEl.className = 'celebrate-line';

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'celebrate-dismiss';
  dismissBtn.textContent = 'Continue';

  panel.append(confetti, starsRow, praiseEl, lineEl, dismissBtn);
  scrim.appendChild(panel);
  parent.appendChild(scrim);

  let onDismiss = null;
  function close() {
    scrim.style.display = 'none';
    const cb = onDismiss;
    onDismiss = null;
    if (cb) cb();
  }
  dismissBtn.addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

  function show({ surahName = '', stars = 0, onDismiss: cb } = {}) {
    onDismiss = cb || null;

    // Build the (1..3) earned stars plus muted placeholders up to 3, so the
    // child can see how close they were.
    starsRow.innerHTML = '';
    const shown = Math.max(0, Math.min(3, stars));
    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      const earned = i < shown;
      star.className = 'celebrate-star' + (earned ? ' celebrate-star--on' : ' celebrate-star--off');
      star.textContent = earned ? '★' : '☆';
      star.style.animationDelay = `${i * 220}ms`;
      starsRow.appendChild(star);
    }

    praiseEl.textContent = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    const name = surahName ? ` Surah ${surahName}` : ' this surah';
    if (shown >= 3)      lineEl.textContent = `Perfect!${name} complete - three stars!`;
    else if (shown === 2) lineEl.textContent = `Great job!${name} complete - two stars!`;
    else                  lineEl.textContent = `${name.trim()} complete — keep practicing for more stars!`;

    // Retrigger the pop animation by toggling a class on each show.
    scrim.classList.remove('celebrate-scrim--in');
    scrim.style.display = '';
    // force reflow so the animation restarts
    void scrim.offsetWidth;
    scrim.classList.add('celebrate-scrim--in');
  }

  return { show, close, destroy: () => scrim.remove() };
}
