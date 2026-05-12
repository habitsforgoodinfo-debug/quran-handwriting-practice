export function showSummary(root, { sessionStats, onPracticeAgain, onPickNew }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal';
  const lettersTop = topN(sessionStats.letterErrors, 3);
  const diaTop = topN(sessionStats.diacriticErrors, 3);
  overlay.innerHTML = `
    <div class="modal__panel">
      <h3>Session complete</h3>
      <p>Words written: ${sessionStats.wordsWritten} / ${sessionStats.wordsTotal}</p>
      <p>Letter errors: ${sessionStats.letterErrorsTotal} ${lettersTop ? `(top: ${lettersTop})` : ''}</p>
      <p>Harakah errors: ${sessionStats.diacriticErrorsTotal} ${diaTop ? `(top: ${diaTop})` : ''}</p>
      <button class="again">Practice again</button>
      <button class="new">Pick new range</button>
    </div>`;
  root.appendChild(overlay);
  overlay.querySelector('.again').addEventListener('click', () => { overlay.remove(); onPracticeAgain(); });
  overlay.querySelector('.new').addEventListener('click', () => { overlay.remove(); onPickNew(); });
}

function topN(map, n) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
  return entries.length ? entries.map(([k, v]) => `${k} ×${v}`).join(', ') : '';
}
