import { _diacriticCharByName } from './parser.js';

// Mirror the parser's diacritic-name → char map.
const DIACRITIC_CHAR = _diacriticCharByName;

// Render the user's typed stream verbatim. Letters keep their typed form;
// mismatches get the .mistake class.
export function renderUserStream(container, annotations) {
  for (const a of annotations) {
    if (a.kind === 'space') {
      container.appendChild(document.createTextNode(' '));
      continue;
    }
    const g = document.createElement('span');
    g.className = 'glyph';

    const letter = document.createElement('span');
    letter.className = 'glyph__letter';
    letter.textContent = a.user.letter;
    if (a.letterStatus !== 'ok') letter.classList.add('mistake');
    g.appendChild(letter);

    const diaMistake = (a.diaStatus !== 'ok' && a.diaStatus !== 'n/a');
    for (const ch of a.user.diacriticChars) {
      const d = document.createElement('span');
      d.className = 'dia';
      if (diaMistake) d.classList.add('mistake');
      d.textContent = ch;
      g.appendChild(d);
    }
    container.appendChild(g);
  }
}

// Render the CANONICAL verse with green highlights on the user's MISTAKES.
// glyphResultsByWord: Map<wordIdx, Array<{letterMatch, diacriticMatch, ...}>>
// (or a plain object keyed by wordIdx). Words with no result entry get full
// highlighting (everything is shown as a correction).
export function renderCorrectVerse(container, expectedVerse, glyphResultsByWord) {
  const line = document.createElement('div');
  line.className = 'correct-line';
  const label = document.createElement('div');
  label.className = 'correct-label';
  label.textContent = 'Correction:';
  line.appendChild(label);

  const wordsEl = document.createElement('div');
  wordsEl.className = 'correct-words';

  const getResults = (wi) => {
    if (!glyphResultsByWord) return [];
    if (typeof glyphResultsByWord.get === 'function') return glyphResultsByWord.get(wi) || [];
    return glyphResultsByWord[wi] || [];
  };

  for (let wi = 0; wi < expectedVerse.length; wi++) {
    const word = expectedVerse[wi];
    const results = getResults(wi);
    const wordEl = document.createElement('span');
    wordEl.className = 'word correct-word';

    for (let gi = 0; gi < word.length; gi++) {
      const expected = word[gi];
      const r = results[gi];
      const g = document.createElement('span');
      g.className = 'glyph';

      const letter = document.createElement('span');
      letter.className = 'glyph__letter';
      letter.textContent = expected.letter;
      if (!r || r.letterMatch !== 'ok') letter.classList.add('correct');
      g.appendChild(letter);

      for (const dn of expected.diacritics) {
        const dia = document.createElement('span');
        dia.className = 'dia';
        dia.textContent = DIACRITIC_CHAR[dn] || '';
        if (!r || r.diacriticMatch !== 'ok') dia.classList.add('correct');
        g.appendChild(dia);
      }
      wordEl.appendChild(g);
    }
    wordsEl.appendChild(wordEl);
    wordsEl.appendChild(document.createTextNode(' '));
  }
  line.appendChild(wordsEl);
  container.appendChild(line);
}

export function clearVerseDisplay(container) { container.innerHTML = ''; }
