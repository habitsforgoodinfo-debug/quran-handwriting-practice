import { RECITERS } from '../audio/player.js';
import { ALL_HARAKAT as ALL_HARAKAT_NAMES } from '../store/settings.js';

// Letter order mirrors the keypad rows top-to-bottom so the user can scan
// the same arrangement in both places.
const TOGGLEABLE_LETTERS = [
  // Row 1
  ['ض','duad'], ['ص','suad'], ['ث','tha'],  ['ق','qaf'], ['ف','fa'],
  ['غ','ghain'],['ع','ain'],  ['ه','ha'],   ['خ','kha'], ['ح','haa'], ['ج','jeem'],
  // Row 2
  ['ش','sheen'],['س','seen'], ['ي','ya'],   ['ب','ba'],  ['ل','lam'],
  ['ا','alif'], ['ت','ta'],   ['ن','noon'], ['م','meem'],['ك','kaf'], ['ط','tua'],
  // Row 3
  ['ذ','zal'],  ['ء','hamza'],['ر','ra'],   ['ة','ta-marbuta'],
  ['و','waw'],  ['ز','za'],   ['ظ','zua'],  ['د','dal']
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

  // ---- Required letters ----
  const lettersBlock = document.createElement('div');
  lettersBlock.className = 'required-letters';
  const lettersTitle = document.createElement('div');
  lettersTitle.className = 'required-letters__title';
  lettersTitle.textContent = 'Required letters (selected letters must be written; others are auto-filled)';
  const lettersGrid = document.createElement('div');
  lettersGrid.className = 'required-letters__grid';

  const requiredLettersSet = new Set(settings.requiredLetters || []);
  function emitLetters() { onChange({ requiredLetters: [...requiredLettersSet] }); }

  for (const [ch, name] of TOGGLEABLE_LETTERS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'letter-chip' + (requiredLettersSet.has(ch) ? ' letter-chip--required' : '');
    chip.dataset.letter = ch;
    chip.setAttribute('title', name);
    const g = document.createElement('span'); g.className = 'letter-chip__glyph'; g.textContent = ch;
    const n = document.createElement('span'); n.className = 'letter-chip__name';  n.textContent = name;
    chip.append(g, n);
    chip.addEventListener('click', () => {
      if (requiredLettersSet.has(ch)) { requiredLettersSet.delete(ch); chip.classList.remove('letter-chip--required'); }
      else                            { requiredLettersSet.add(ch);    chip.classList.add('letter-chip--required'); }
      emitLetters();
    });
    lettersGrid.appendChild(chip);
  }
  lettersBlock.append(lettersTitle, lettersGrid);

  // ---- Quick retry test every 20 verses ----
  const labQuickTest = document.createElement('label');
  labQuickTest.append('Quick retry test after every 20 verses ');
  const quickTest = document.createElement('input');
  quickTest.type = 'checkbox';
  quickTest.className = 'quick-test';
  quickTest.checked = settings.quickTestEvery20 !== false;
  labQuickTest.appendChild(quickTest);
  quickTest.addEventListener('change', () => onChange({ quickTestEvery20: quickTest.checked }));

  // ---- Auto-fill all harakat ----
  const labAutoHarakat = document.createElement('label');
  labAutoHarakat.append('Auto-fill all harakat (skip typing diacritics) ');
  const autoHarakat = document.createElement('input');
  autoHarakat.type = 'checkbox';
  autoHarakat.className = 'auto-harakat';
  // Checked = no harakat are required = all auto-filled.
  autoHarakat.checked = Array.isArray(settings.requiredHarakat) && settings.requiredHarakat.length === 0;
  labAutoHarakat.appendChild(autoHarakat);
  autoHarakat.addEventListener('change', () => {
    onChange({ requiredHarakat: autoHarakat.checked ? [] : ALL_HARAKAT_NAMES });
  });

  // ---- Test madd ----
  const labRequireMadd = document.createElement('label');
  labRequireMadd.append('Test madd (require typing the madd sign) ');
  const requireMadd = document.createElement('input');
  requireMadd.type = 'checkbox';
  requireMadd.className = 'require-madd';
  requireMadd.checked = !!settings.requireMadd;
  labRequireMadd.appendChild(requireMadd);
  requireMadd.addEventListener('change', () => {
    onChange({ requireMadd: requireMadd.checked });
  });

  const resetBtn = document.createElement('button');
  resetBtn.className = 'reset-stats';
  resetBtn.textContent = 'Reset stats';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = 'Close';

  panel.append(
    h, labReciter, labHint, labAutoPlay, labSilent, labWidth,
    labQuickTest,
    lettersBlock, labAutoHarakat, labRequireMadd,
    resetBtn, closeBtn
  );
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
