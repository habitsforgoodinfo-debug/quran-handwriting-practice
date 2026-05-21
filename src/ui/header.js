import { SURAHS, getSurah } from '../data/surah-metadata.js';

export function mountHeader(root, {
  onChange, onOpenSettings, onScriptToggle, onOpenBook, onOpenRapidFire,
  onPrevAyah, onNextReviewAyah,
  initial
}) {
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
  rapidBtn.title = 'Pop quiz — listen & write a verse you previously struggled with';
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

  function updateStats({ coverage, accuracy }) {
    const cov = coverage
      ? `${coverage.versesWritten} ayahs · ${coverage.percent}% of Quran`
      : '';
    const acc = (accuracy && accuracy.percent != null)
      ? ` · ${accuracy.percent}% accuracy`
      : '';
    statsEl.textContent = cov + acc;
  }

  emit();
  return { updateStats, setReviewMode };
}
