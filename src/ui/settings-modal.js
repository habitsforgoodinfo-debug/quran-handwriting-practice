import { RECITERS } from '../audio/player.js';

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

  const resetBtn = document.createElement('button');
  resetBtn.className = 'reset-stats';
  resetBtn.textContent = 'Reset stats';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = 'Close';

  panel.append(h, labReciter, labHint, labAutoPlay, labSilent, labWidth, resetBtn, closeBtn);
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
