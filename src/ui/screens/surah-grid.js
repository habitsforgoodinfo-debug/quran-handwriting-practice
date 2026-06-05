// Surah picker: 3-column grid of all 114 surahs.
// mountSurahGrid(rootEl, { onPick, onBack }) -> { refreshStats({ accMap, progressBySurah }) }

import { SURAHS } from '../../data/surah-metadata.js';
import { starsFor } from '../../stats/stars.js';

// Mirrors header.js threshold: low accuracy below 50%.
const LOW_ACC_THRESHOLD = 50;

export function mountSurahGrid(rootEl, { onPick, onBack }) {
  rootEl.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'surah-grid__header';

  const backBtn = document.createElement('button');
  backBtn.className = 'surah-grid__back';
  backBtn.type = 'button';
  backBtn.textContent = '←';
  backBtn.title = 'Back';
  backBtn.addEventListener('click', () => onBack());

  const heading = document.createElement('h2');
  heading.className = 'surah-grid__heading';
  heading.textContent = 'Pick a surah';

  header.append(backBtn, heading);

  const grid = document.createElement('div');
  grid.className = 'surah-grid__grid';

  // Track which tile currently shows the expand choice.
  let openTileEl = null;

  // Map from surah number to { tileEl, badgeEl, choiceEl }
  const tileMap = new Map();

  function collapseOpen() {
    if (openTileEl) {
      const choiceEl = openTileEl.querySelector('.surah-tile__choice');
      if (choiceEl) choiceEl.remove();
      openTileEl.classList.remove('surah-tile--open');
      openTileEl = null;
    }
  }

  for (const s of SURAHS) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'surah-tile';
    tile.setAttribute('aria-label', `Surah ${s.number}: ${s.name_en}`);

    const numEl = document.createElement('span');
    numEl.className = 'surah-tile__num';
    numEl.textContent = String(s.number);

    const arEl = document.createElement('span');
    arEl.className = 'surah-tile__ar';
    arEl.textContent = s.name_ar;

    const enEl = document.createElement('span');
    enEl.className = 'surah-tile__en';
    enEl.textContent = s.name_en;

    const statsEl = document.createElement('span');
    statsEl.className = 'surah-tile__stats';
    // Initially empty; refreshStats will populate.

    tile.append(numEl, arEl, enEl, statsEl);

    tile.addEventListener('click', (e) => {
      // Ignore clicks on the choice buttons themselves (handled separately).
      if (e.target.classList.contains('surah-tile__choice-btn')) return;

      if (openTileEl === tile) {
        collapseOpen();
        return;
      }
      collapseOpen();

      // Need progress data stored on the tile.
      const lastAyah = tile._lastAyah;
      if (lastAyah && lastAyah > 1) {
        tile.classList.add('surah-tile--open');
        openTileEl = tile;

        const choice = document.createElement('div');
        choice.className = 'surah-tile__choice';

        const startBtn = document.createElement('button');
        startBtn.className = 'surah-tile__choice-btn surah-tile__choice-btn--start';
        startBtn.type = 'button';
        startBtn.textContent = 'Start over';
        startBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          collapseOpen();
          onPick({ surah: s.number, ayah: 1 });
        });

        const contBtn = document.createElement('button');
        contBtn.className = 'surah-tile__choice-btn surah-tile__choice-btn--continue';
        contBtn.type = 'button';
        contBtn.textContent = `Continue from ayah ${lastAyah}`;
        contBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          collapseOpen();
          onPick({ surah: s.number, ayah: lastAyah });
        });

        choice.append(startBtn, contBtn);
        tile.appendChild(choice);
      } else {
        onPick({ surah: s.number, ayah: 1 });
      }
    });

    tileMap.set(s.number, { tileEl: tile, statsEl });
    grid.appendChild(tile);
  }

  // Collapse open tile when clicking outside any tile.
  rootEl.addEventListener('click', (e) => {
    if (openTileEl && !openTileEl.contains(e.target)) {
      collapseOpen();
    }
  });

  rootEl.append(header, grid);

  function refreshStats({ accMap = {}, progressBySurah = {} } = {}) {
    for (const s of SURAHS) {
      const entry = tileMap.get(s.number);
      if (!entry) continue;
      const { tileEl, statsEl } = entry;

      const acc = accMap?.[String(s.number)];
      const prog = progressBySurah?.[s.number] || progressBySurah?.[String(s.number)];

      const written = prog?.written ?? 0;
      const lastAyah = prog?.lastAyah ?? 1;
      // Store for click handler.
      tileEl._lastAyah = lastAyah;

      const pct = (acc && acc.attempts > 0)
        ? Math.round((acc.hits / acc.attempts) * 100)
        : null;
      const stars = starsFor({ written, total: s.verses, accuracyPct: pct ?? 0 });

      // Accuracy color tier: green great / amber mid / coral low.
      tileEl.classList.remove('surah-tile--low', 'surah-tile--acc-good', 'surah-tile--acc-mid', 'surah-tile--complete');
      if (pct != null) {
        if (pct >= 85)      tileEl.classList.add('surah-tile--acc-good');
        else if (pct >= 50) tileEl.classList.add('surah-tile--acc-mid');
        else                tileEl.classList.add('surah-tile--low');
      }
      if (stars > 0) tileEl.classList.add('surah-tile--complete');

      statsEl.innerHTML = '';
      if (stars > 0) {
        const starsEl = document.createElement('span');
        starsEl.className = 'surah-tile__stars';
        starsEl.textContent = '★'.repeat(stars);
        starsEl.setAttribute('aria-label', `${stars} star${stars > 1 ? 's' : ''}`);
        statsEl.appendChild(starsEl);
      }
      const textEl = document.createElement('span');
      textEl.className = 'surah-tile__stats-text';
      if (pct != null) textEl.textContent = `${pct}% · ${written}/${s.verses}`;
      else             textEl.textContent = written > 0 ? `${written}/${s.verses}` : '';
      statsEl.appendChild(textEl);
    }
  }

  return { refreshStats };
}
