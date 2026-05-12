import { renderUserWord, renderCorrectVerse, clearVerseDisplay } from '../verse/renderer.js';

export function mountVerseDisplay(root, { onPlayVerse }) {
  root.innerHTML = '';
  const versesEl = document.createElement('div');
  versesEl.className = 'verses';
  const controls = document.createElement('div');
  controls.className = 'verse-controls';
  const playBtn = document.createElement('button');
  playBtn.textContent = '▶ play verse';
  playBtn.addEventListener('click', () => onPlayVerse());
  controls.append(playBtn);
  root.append(versesEl, controls);

  return {
    startNewVerse: () => {
      const v = document.createElement('div');
      v.className = 'verse-line user-line';
      versesEl.appendChild(v);
      return {
        appendWord: (alignment) => renderUserWord(v, alignment),
        appendCorrectVerse: (expectedWords, wordAlignments) => renderCorrectVerse(versesEl, expectedWords, wordAlignments)
      };
    },
    reset: () => clearVerseDisplay(versesEl)
  };
}
