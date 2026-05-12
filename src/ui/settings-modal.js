import { RECITERS } from '../audio/player.js';

export function mountSettingsModal(root, { settings, onChange, onResetStats, onClose }) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__panel">
      <h3>Settings</h3>
      <label>Reciter
        <select class="reciter">
          ${RECITERS.map(r => `<option value="${r.id}">${r.name}</option>`).join('')}
        </select>
      </label>
      <label>Show silent letters in distinct color
        <input type="checkbox" class="silent-toggle" />
      </label>
      <label>Stroke width <input type="number" min="1" max="20" class="stroke-width" /></label>
      <button class="reset-stats">Reset stats</button>
      <button class="close">Close</button>
    </div>`;
  root.appendChild(modal);

  const reciter = modal.querySelector('.reciter');
  const silent = modal.querySelector('.silent-toggle');
  const sw = modal.querySelector('.stroke-width');
  reciter.value = settings.reciter;
  silent.checked = settings.silentLetterColorOn;
  sw.value = String(settings.strokeWidth);

  reciter.addEventListener('change', () => onChange({ reciter: reciter.value }));
  silent.addEventListener('change', () => onChange({ silentLetterColorOn: silent.checked }));
  sw.addEventListener('change', () => onChange({ strokeWidth: parseInt(sw.value, 10) }));
  modal.querySelector('.reset-stats').addEventListener('click', onResetStats);
  modal.querySelector('.close').addEventListener('click', () => { modal.remove(); onClose?.(); });

  return { close: () => { modal.remove(); onClose?.(); } };
}
