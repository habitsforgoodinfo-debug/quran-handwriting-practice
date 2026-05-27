import { getCompletedVerses } from '../store/stats.js';
import { getSurah } from '../data/surah-metadata.js';
import { cleanVerseForDisplay } from '../verse/parser.js';

export async function mountMyBook(root) {
  const modal = document.createElement('div');
  modal.className = 'modal';

  const panel = document.createElement('div');
  panel.className = 'modal__panel my-book__panel';

  const head = document.createElement('div');
  head.className = 'my-book__head';
  const h = document.createElement('h3');
  h.textContent = '📖 My book — verses I have written by hand';
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

  const written = verses.filter(v => !v.skipped);
  if (written.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'my-book__empty';
    empty.textContent = 'Your book is empty for now. Finish an ayah to add it here.';
    body.appendChild(empty);
    return;
  }

  // Group by surah, preserving order.
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
    title.className = 'my-book__surah-title';
    title.textContent = `${meta?.name_en || 'Surah ' + surahNum} · ${meta?.name_ar || ''}`;
    block.appendChild(title);

    // Render as a flowing mushaf-style paragraph: verses run together,
    // separated by their ayah-number marker. Skipped ayahs become an
    // inline `…(N)` placeholder.
    const flow = document.createElement('div');
    flow.className = 'my-book__flow';
    flow.dir = 'rtl';

    for (const v of list) {
      if (v.skipped) {
        const skip = document.createElement('span');
        skip.className = 'my-book__skip my-book__skip--inline';
        skip.textContent = ` ⋯(${v.ayah}) `;
        skip.title = `Ayah ${v.ayah} — not yet completed`;
        flow.appendChild(skip);
        continue;
      }
      const text = document.createElement('span');
      text.className = 'my-book__text' + (v.perfect ? ' my-book__text--perfect' : '');
      text.textContent = cleanVerseForDisplay(v.rawText);
      const marker = document.createElement('span');
      marker.className = 'my-book__marker';
      marker.textContent = `۝${v.ayah} `;
      flow.append(text, document.createTextNode(' '), marker);
    }
    block.appendChild(flow);
    body.appendChild(block);
  }

  const summary = document.createElement('div');
  summary.className = 'my-book__note';
  const completedCount = written.length;
  const skippedCount = verses.length - completedCount;
  summary.textContent = `${completedCount} ayahs written`
    + (skippedCount ? ` · ${skippedCount} placeholders for skipped` : '')
    + '. ★ marks ayahs you wrote without any mistake.';
  body.appendChild(summary);
}
