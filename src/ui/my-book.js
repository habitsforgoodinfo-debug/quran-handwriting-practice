import { getCompletedVerses } from '../store/stats.js';
import { getSurah } from '../data/surah-metadata.js';

export async function mountMyBook(root) {
  const modal = document.createElement('div');
  modal.className = 'modal';

  const panel = document.createElement('div');
  panel.className = 'modal__panel my-book__panel';

  const head = document.createElement('div');
  head.className = 'my-book__head';
  const h = document.createElement('h3');
  h.textContent = '📖 My book — verses written by your hand';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => modal.remove());
  head.append(h, closeBtn);

  const body = document.createElement('div');
  body.className = 'my-book__body';
  body.textContent = 'Loading…';

  panel.append(head, body);
  modal.appendChild(panel);
  root.appendChild(modal);

  const verses = await getCompletedVerses();
  body.innerHTML = '';

  if (verses.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'my-book__empty';
    empty.textContent = 'Your book is empty for now. Finish an ayah to add it here.';
    body.appendChild(empty);
    return;
  }

  // Group by surah
  const bySurah = new Map();
  for (const v of verses) {
    if (!bySurah.has(v.surah)) bySurah.set(v.surah, []);
    bySurah.get(v.surah).push(v);
  }

  for (const [surahNum, list] of bySurah) {
    const block = document.createElement('section');
    block.className = 'my-book__surah';
    const meta = getSurah(surahNum);
    const title = document.createElement('h4');
    title.textContent = `${meta?.name_en || 'Surah ' + surahNum} · ${meta?.name_ar || ''}`;
    block.appendChild(title);

    for (const v of list) {
      const verseLine = document.createElement('p');
      verseLine.className = 'my-book__verse';
      const num = document.createElement('span');
      num.className = 'my-book__num';
      num.textContent = `${v.ayah}`;
      const text = document.createElement('span');
      text.className = 'my-book__text';
      text.textContent = v.rawText;
      if (v.perfect) {
        const star = document.createElement('span');
        star.className = 'my-book__star'; star.textContent = '★';
        verseLine.appendChild(star);
      }
      verseLine.append(text, num);
      block.appendChild(verseLine);
    }
    body.appendChild(block);
  }

  const note = document.createElement('div');
  note.className = 'my-book__note';
  note.textContent = `${verses.length} ayahs written. (PDF export coming soon.)`;
  body.appendChild(note);
}
