import { SURAHS, getSurah } from '../data/surah-metadata.js';

export function mountHeader(root, { onChange, onOpenSettings, onScriptToggle, initial }) {
  root.innerHTML = '';
  const surahSel = document.createElement('select');
  surahSel.className = 'surah';
  for (const s of SURAHS) {
    const opt = document.createElement('option');
    opt.value = String(s.number);
    opt.textContent = `${s.number}. ${s.name_en} · ${s.name_ar}`;
    surahSel.appendChild(opt);
  }
  surahSel.value = String(initial.surah);

  const fromInput = document.createElement('input');
  fromInput.className = 'from'; fromInput.type = 'number'; fromInput.min = '1'; fromInput.value = String(initial.fromAyah);
  const toInput = document.createElement('input');
  toInput.className = 'to'; toInput.type = 'number'; toInput.min = '1'; toInput.value = String(initial.toAyah);

  const scriptBtn = document.createElement('button');
  scriptBtn.className = 'script-toggle';
  scriptBtn.textContent = (initial.script === 'uthmani') ? 'Uthmani' : 'Indo-Pak';
  scriptBtn.title = 'Toggle script (Indo-Pak / Uthmani)';
  scriptBtn.addEventListener('click', () => {
    const next = scriptBtn.textContent === 'Indo-Pak' ? 'uthmani' : 'indopak';
    scriptBtn.textContent = next === 'uthmani' ? 'Uthmani' : 'Indo-Pak';
    if (onScriptToggle) onScriptToggle(next);
  });

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'settings'; settingsBtn.textContent = '⚙'; settingsBtn.title = 'Settings';

  root.append(surahSel, document.createTextNode(' From '), fromInput, document.createTextNode(' To '), toInput, scriptBtn, settingsBtn);

  function emit() {
    const surah = parseInt(surahSel.value, 10);
    const meta = getSurah(surah);
    let from = Math.max(1, Math.min(parseInt(fromInput.value, 10) || 1, meta.verses));
    let to   = Math.max(from, Math.min(parseInt(toInput.value, 10) || from, meta.verses));
    fromInput.max = String(meta.verses);
    toInput.max = String(meta.verses);
    fromInput.value = String(from);
    toInput.value = String(to);
    onChange({ surah, fromAyah: from, toAyah: to });
  }

  surahSel.addEventListener('change', emit);
  fromInput.addEventListener('change', emit);
  toInput.addEventListener('change', emit);
  settingsBtn.addEventListener('click', () => onOpenSettings());

  emit();
}
