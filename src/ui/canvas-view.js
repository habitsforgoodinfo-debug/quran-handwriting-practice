import { CanvasInput } from '../canvas/input.js';
import { isCommitSwipe } from '../canvas/gestures.js';

export function mountCanvasView(root, { onCommit, strokeColor, strokeWidth }) {
  root.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'draw-canvas';
  const hint = document.createElement('div');
  hint.className = 'commit-hint';
  hint.textContent = '← swipe right-to-left to commit';
  const undoBtn = document.createElement('button');
  undoBtn.className = 'undo';
  undoBtn.textContent = '↺ undo';
  root.append(canvas, hint, undoBtn);

  function resize() {
    const r = root.getBoundingClientRect();
    canvas.width = Math.max(200, Math.floor(r.width));
    canvas.height = Math.max(120, Math.floor(r.height));
  }
  resize();
  window.addEventListener('resize', resize);

  const input = new CanvasInput(canvas, {
    strokeColor, strokeWidth,
    onStroke: (stroke) => {
      if (isCommitSwipe(stroke, canvas)) {
        const all = input.getStrokes();
        const idx = all.indexOf(stroke);
        if (idx >= 0) all.splice(idx, 1);
        const committed = all.slice();
        input.clear();
        onCommit(committed, { width: canvas.width, height: canvas.height });
        hint.style.display = 'none';
      }
    }
  });

  return {
    canvas,
    clear: () => { input.clear(); hint.style.display = ''; },
    onUndoClick: (cb) => undoBtn.addEventListener('click', cb),
    destroy: () => {
      window.removeEventListener('resize', resize);
    }
  };
}
