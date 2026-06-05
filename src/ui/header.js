import { SURAHS, getSurah } from '../data/surah-metadata.js';

export function mountHeader(root, {
  onChange, onOpenSettings, onScriptToggle, onOpenBook, onOpenRapidFire,
  onPrevAyah, onNextReviewAyah,
  initial
}) {
  root.innerHTML = '';
  const surahSel = document.createElement('select');
  surahSel.className = 'surah';
  const surahOpts = new Map(); // surah number → <option>
  for (const s of SURAHS) {
    const opt = document.createElement('option');
    opt.value = String(s.number);
    opt.dataset.baseLabel = `${s.number}. ${s.name_en} · ${s.name_ar}`;
    opt.textContent = opt.dataset.baseLabel;
    surahSel.appendChild(opt);
    surahOpts.set(s.number, opt);
  }
  surahSel.value = String(initial.surah);

  const ayahInput = document.createElement('input');
  ayahInput.className = 'from';
  ayahInput.type = 'number'; ayahInput.min = '1';
  ayahInput.value = String(initial.fromAyah);
  ayahInput.title = 'Start at ayah';

  const scriptBtn = document.createElement('button');
  scriptBtn.className = 'script-toggle';
  scriptBtn.textContent = (initial.script === 'uthmani') ? 'Uthmani' : 'Indo-Pak';
  scriptBtn.title = 'Toggle script (Indo-Pak / Uthmani)';
  scriptBtn.addEventListener('click', () => {
    const next = scriptBtn.textContent === 'Indo-Pak' ? 'uthmani' : 'indopak';
    scriptBtn.textContent = next === 'uthmani' ? 'Uthmani' : 'Indo-Pak';
    if (onScriptToggle) onScriptToggle(next);
  });

  const bookBtn = document.createElement('button');
  bookBtn.className = 'my-book'; bookBtn.textContent = '📖'; bookBtn.title = 'My book';
  bookBtn.addEventListener('click', () => onOpenBook && onOpenBook());

  const rapidBtn = document.createElement('button');
  rapidBtn.className = 'rapid-fire'; rapidBtn.textContent = '📝';
  rapidBtn.title = 'Pop quiz - listen & write a verse you previously struggled with';
  rapidBtn.addEventListener('click', () => onOpenRapidFire && onOpenRapidFire());

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'settings'; settingsBtn.textContent = '⚙'; settingsBtn.title = 'Settings';
  settingsBtn.addEventListener('click', () => onOpenSettings());

  const prevBtn = document.createElement('button');
  prevBtn.className = 'prev-ayah'; prevBtn.textContent = '←';
  prevBtn.title = 'Review previous ayah';
  prevBtn.addEventListener('click', () => onPrevAyah && onPrevAyah());

  const nextReviewBtn = document.createElement('button');
  nextReviewBtn.className = 'next-review-ayah'; nextReviewBtn.textContent = '→';
  nextReviewBtn.title = 'Forward (return to your live ayah)';
  nextReviewBtn.style.display = 'none';
  nextReviewBtn.addEventListener('click', () => onNextReviewAyah && onNextReviewAyah());

  const statsEl = document.createElement('div');
  statsEl.className = 'header-stats';
  statsEl.textContent = '';

  root.append(
    surahSel,
    document.createTextNode(' Ayah '),
    ayahInput,
    prevBtn, nextReviewBtn,
    scriptBtn,
    bookBtn, rapidBtn, settingsBtn,
    statsEl
  );

  function setReviewMode(on) {
    nextReviewBtn.style.display = on ? '' : 'none';
  }

  function emit() {
    const surah = parseInt(surahSel.value, 10);
    const meta = getSurah(surah);
    let from = Math.max(1, Math.min(parseInt(ayahInput.value, 10) || 1, meta.verses));
    ayahInput.max = String(meta.verses);
    ayahInput.value = String(from);
    onChange({ surah, fromAyah: from, toAyah: meta.verses });
  }

  surahSel.addEventListener('change', emit);
  ayahInput.addEventListener('change', emit);

  // Stats banner: only the current surah's progress + accuracy.
  function updateStats({ surah, surahName, surahVerses, ayahsWritten, accuracy }) {
    if (!surah || !surahVerses) { statsEl.textContent = ''; return; }
    const pct = Math.min(100, Math.round((ayahsWritten / surahVerses) * 100));
    const accPart = (accuracy && accuracy.percent != null)
      ? ` · ${accuracy.percent}% accuracy`
      : '';
    statsEl.textContent =
      `${surahName}: ${ayahsWritten}/${surahVerses} ayahs (${pct}% of surah)${accPart}`;
  }

  // Per-surah accuracy badges in the dropdown. accMap is { "1": {hits, attempts}, ... }
  function updateSurahAccuracyMap(accMap) {
    for (const [num, opt] of surahOpts) {
      const e = accMap?.[String(num)];
      const base = opt.dataset.baseLabel;
      if (!e || !e.attempts) {
        opt.textContent = base;
        opt.classList.remove('surah-opt--low');
        continue;
      }
      const pct = Math.round((e.hits / e.attempts) * 100);
      opt.textContent = `${base} - ${pct}%`;
      opt.classList.toggle('surah-opt--low', pct < 50);
    }
  }

  emit();
  return { updateStats, updateSurahAccuracyMap, setReviewMode };
}
