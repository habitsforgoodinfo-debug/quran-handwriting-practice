// Step-by-step welcome tutorial. One idea per screen, plain language,
// Next / Back navigation. Shown until the user ticks "don't show again"
// on the final screen (persisted in settings.hideIntro).

const STEPS = [
  {
    title: 'Welcome',
    body:
      "This app helps you learn to write the Quran by hand, one verse at a time. " +
      "Let's walk through how it works — it only takes a minute."
  },
  {
    title: 'Pick a verse',
    body:
      "At the top of the screen, choose a sūrah and a starting verse. " +
      "The verse will then appear in the middle of the screen."
  },
  {
    title: 'Read / listen, then write',
    body:
      "The upper box shows the verse in English letters — that tells you what to write. " +
      "The middle box is empty. That is where your writing will appear. " +
      "If you would also like to hear the verse first, tap the ▶ button under the keyboard. " +
      "Then use the keyboard at the bottom to type the Arabic letters and harakat, one at a time."
  },
  {
    title: "Help when you're stuck",
    body:
      "Only the correct key is accepted. " +
      "If you press the wrong key twice in a row, the correct key will glow green. " +
      "Just tap the glowing key to keep going."
  },
  {
    title: 'The three action buttons',
    body:
      "Below the keyboard you will see three buttons:\n\n" +
      "⌫   delete the last letter\n" +
      "→   skip to the next verse\n" +
      "▶   hear the verse recited"
  },
  {
    title: 'Make it easier (Settings)',
    body:
      "Tap the ⚙ gear at the top to open Settings. There you can:\n\n" +
      "• Choose which letters you want to write. The others will fill in by themselves.\n" +
      "• Turn off all harakat (the small marks) so you only write the letters.\n" +
      "• Change the reciter or how hints appear.\n\n" +
      "Letters shown in yellow are the ones you must write yourself."
  },
  {
    title: "That's it",
    body:
      "After every 20 verses, the app will quickly retest the ones you slipped on, " +
      "so you can fix them while they are fresh.\n\n" +
      "All your finished verses are saved in 📖 My Book.\n\n" +
      "You are ready. Tap “Start writing” whenever you like."
  }
];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function mountIntro(root, { onHide, onDismiss }) {
  const modal = el('div', 'modal intro-modal');
  const panel = el('div', 'modal__panel intro__panel intro__panel--tutorial');

  let step = 0;

  const progress = el('div', 'intro__progress');
  const title    = el('h2', 'intro__step-title');
  const body     = el('div', 'intro__step-body');

  const checkRow = el('label', 'intro__check intro__check--final');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'intro__check-box';
  checkRow.append(cb, document.createTextNode(" Don't show this again"));

  const nav = el('div', 'intro__nav');
  const backBtn  = el('button', 'intro__btn intro__btn--back', '← Back');
  const nextBtn  = el('button', 'intro__btn intro__btn--next', 'Next →');
  const startBtn = el('button', 'intro__btn intro__btn--start', 'Start writing');
  nav.append(backBtn, nextBtn, startBtn);

  panel.append(progress, title, body, checkRow, nav);
  modal.appendChild(panel);
  root.appendChild(modal);

  function render() {
    const s = STEPS[step];
    progress.textContent = `Step ${step + 1} of ${STEPS.length}`;
    title.textContent = s.title;
    body.textContent = s.body;
    backBtn.disabled  = step === 0;
    const isLast = step === STEPS.length - 1;
    nextBtn.style.display  = isLast ? 'none' : '';
    startBtn.style.display = isLast ? '' : 'none';
    checkRow.style.display = isLast ? '' : 'none';
  }

  async function close() {
    if (cb.checked && onHide) await onHide();
    modal.remove();
    if (onDismiss) onDismiss();
  }

  backBtn.addEventListener('click',  () => { if (step > 0) { step--; render(); } });
  nextBtn.addEventListener('click',  () => { if (step < STEPS.length - 1) { step++; render(); } });
  startBtn.addEventListener('click', close);

  render();
}
