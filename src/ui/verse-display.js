import { renderWord, clearVerseDisplay } from '../verse/renderer.js';

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
      v.className = 'verse-line';
      versesEl.appendChild(v);
      return {
        appendWord: (alignment, opts) => renderWord(v, alignment, opts)
      };
    },
    reset: () => clearVerseDisplay(versesEl)
  };
}
