import { RECITERS } from '../audio/player.js';

// Letters offered as toggleable "required" chips in the settings modal.
// Order roughly matches the Arabic alphabet so it reads naturally.
const TOGGLEABLE_LETTERS = [
  ['ا','alif'], ['ب','ba'], ['ت','ta'], ['ث','tha'], ['ج','jeem'],
  ['ح','haa'], ['خ','kha'], ['د','dal'], ['ذ','zal'], ['ر','ra'],
  ['ز','za'], ['س','seen'], ['ش','sheen'], ['ص','suad'], ['ض','duad'],
  ['ط','tua'], ['ظ','zua'], ['ع','ain'], ['غ','ghain'], ['ف','fa'],
  ['ق','qaf'], ['ك','kaf'], ['ل','lam'], ['م','meem'], ['ن','noon'],
  ['ه','ha'], ['و','waw'], ['ي','ya'], ['ء','hamza'], ['ة','ta-marbuta']
];

export function mountSettingsModal(root, { settings, onChange, onResetStats, onClose }) {
  const modal = document.createElement('div');
  modal.className = 'modal';

  const panel = document.createElement('div');
  panel.className = 'modal__panel';

  const h = document.createElement('h3');
  h.textContent = 'Settings';

  const labReciter = document.createElement('label');
  labReciter.append('Reciter ');
  const reciter = document.createElement('select');
  reciter.className = 'reciter';
  for (const r of RECITERS) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    reciter.appendChild(opt);
  }
  reciter.value = settings.reciter;
  labReciter.appendChild(reciter);

  const labHint = document.createElement('label');
  labHint.append('Hint timing ');
  const hint = document.createElement('select');
  hint.className = 'hint-policy';
  const OPTS = [
    ['auto',   'Try first, then help'],
    ['always', 'Always show'],
    ['none',   'Never show']
  ];
  for (const [val, label] of OPTS) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    hint.appendChild(opt);
  }
  hint.value = settings.hintPolicy || 'auto';
  labHint.appendChild(hint);
  hint.addEventListener('change', () => onChange({ hintPolicy: hint.value }));

  const labSilent = document.createElement('label');
  labSilent.append('Show silent letters in distinct color ');
  const silent = document.createElement('input');
  silent.type = 'checkbox';
  silent.className = 'silent-toggle';
  silent.checked = settings.silentLetterColorOn;
  labSilent.appendChild(silent);

  const labAutoPlay = document.createElement('label');
  labAutoPlay.append('Recite verse audio when a new ayah loads ');
  const autoPlay = document.createElement('input');
  autoPlay.type = 'checkbox';
  autoPlay.className = 'auto-play';
  autoPlay.checked = !!settings.autoPlayOnAyahLoad;
  labAutoPlay.appendChild(autoPlay);
  autoPlay.addEventListener('change', () => onChange({ autoPlayOnAyahLoad: autoPlay.checked }));

  const labWidth = document.createElement('label');
  labWidth.append('Stroke width ');
  const sw = document.createElement('input');
  sw.type = 'number'; sw.min = '1'; sw.max = '20';
  sw.className = 'stroke-width';
  sw.value = String(settings.strokeWidth);
  labWidth.appendChild(sw);

  const lettersBlock = document.createElement('div');
  lettersBlock.className = 'required-letters';
  const lettersTitle = document.createElement('div');
  lettersTitle.className = 'required-letters__title';
  lettersTitle.textContent = 'Required letters (unticked letters are auto-filled)';
  const lettersGrid = document.createElement('div');
  lettersGrid.className = 'required-letters__grid';

  const optionalSet = new Set(settings.optionalLetters || []);

  function emitOptional() {
    onChange({ optionalLetters: [...optionalSet] });
  }

  for (const [ch, name] of TOGGLEABLE_LETTERS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'letter-chip' + (optionalSet.has(ch) ? '' : ' letter-chip--required');
    chip.dataset.letter = ch;
    chip.setAttribute('title', name);
    const g = document.createElement('span'); g.className = 'letter-chip__glyph'; g.textContent = ch;
    const n = document.createElement('span'); n.className = 'letter-chip__name';  n.textContent = name;
    chip.append(g, n);
    chip.addEventListener('click', () => {
      if (optionalSet.has(ch)) { optionalSet.delete(ch); chip.classList.add('letter-chip--required'); }
      else                     { optionalSet.add(ch);    chip.classList.remove('letter-chip--required'); }
      emitOptional();
    });
    lettersGrid.appendChild(chip);
  }
  lettersBlock.append(lettersTitle, lettersGrid);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'reset-stats';
  resetBtn.textContent = 'Reset stats';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = 'Close';

  panel.append(h, labReciter, labHint, labAutoPlay, labSilent, labWidth, lettersBlock, resetBtn, closeBtn);
  modal.appendChild(panel);
  root.appendChild(modal);

  reciter.addEventListener('change', () => onChange({ reciter: reciter.value }));
  silent.addEventListener('change', () => onChange({ silentLetterColorOn: silent.checked }));
  sw.addEventListener('change', () => {
    const v = parseInt(sw.value, 10);
    if (Number.isFinite(v) && v >= 1 && v <= 20) onChange({ strokeWidth: v });
  });
  resetBtn.addEventListener('click', onResetStats);
  closeBtn.addEventListener('click', () => { modal.remove(); onClose?.(); });

  return { close: () => { modal.remove(); onClose?.(); } };
}
