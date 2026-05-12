import { renderUserWord, renderCorrectVerse, clearVerseDisplay } from '../verse/renderer.js';

export function mountVerseDisplay(root, { onPlayVerse }) {
  root.innerHTML = '';

  // Two stacked containers; only one is visible at a time.
  const userContainer = document.createElement('div');
  userContainer.className = 'verses verses--user';

  const revealContainer = document.createElement('div');
  revealContainer.className = 'verses verses--reveal';
  revealContainer.style.display = 'none';

  const controls = document.createElement('div');
  controls.className = 'verse-controls';

  const playBtn = document.createElement('button');
  playBtn.textContent = '▶ play verse';
  playBtn.addEventListener('click', () => onPlayVerse());

  const revealBtn = document.createElement('button');
  revealBtn.className = 'reveal-btn';
  revealBtn.textContent = '👁 Reveal';

  let revealing = false;
  revealBtn.addEventListener('click', () => {
    revealing = !revealing;
    revealBtn.textContent = revealing ? '👁 Hide' : '👁 Reveal';
    userContainer.style.display   = revealing ? 'none' : '';
    revealContainer.style.display = revealing ? '' : 'none';
  });

  controls.append(playBtn, revealBtn);
  root.append(userContainer, revealContainer, controls);

  return {
    startNewVerse: () => {
      const v = document.createElement('div');
      v.className = 'verse-line user-line';
      userContainer.appendChild(v);
      return {
        appendWord: (alignment) => renderUserWord(v, alignment),
        appendCorrectVerse: (expectedWords, wordAlignments) => renderCorrectVerse(userContainer, expectedWords, wordAlignments)
      };
    },
    reset: () => {
      clearVerseDisplay(userContainer);
      clearVerseDisplay(revealContainer);
    },
    // Render the canonical verses (one per verse) into the reveal container.
    // Called by main.js whenever the selected range changes.
    setRevealVerses: (verses) => {
      clearVerseDisplay(revealContainer);
      for (const verse of verses) {
        const line = document.createElement('div');
        line.className = 'verse-line reveal-line';
        line.textContent = verse;
        revealContainer.appendChild(line);
      }
    }
  };
}
