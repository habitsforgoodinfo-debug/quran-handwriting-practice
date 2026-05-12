const DIACRITIC_CHAR = {
  fatha: 'َ',
  kasra: 'ِ',
  damma: 'ُ',
  sukun: 'ْ',
  shadda: 'ّ',
  tanween_fath: 'ً',
  tanween_damm: 'ٌ',
  tanween_kasr: 'ٍ',
  dagger_alif: 'ٰ'
};

// Render the user's submitted word on the "attempt" line: white default, red where wrong/missing.
// Silent expected letters are omitted entirely (they belong only on the correct line).
export function renderUserWord(container, alignment) {
  const word = document.createElement('span');
  word.className = 'word user-word';

  for (const r of alignment.result) {
    if (r.letterMatch === 'autofill') continue;

    const g = document.createElement('span');
    g.className = 'glyph';
    const letter = document.createElement('span');
    letter.className = 'glyph__letter';

    if (r.letterMatch === 'missing') {
      letter.textContent = r.expected.letter;
      letter.classList.add('mistake');
    } else {
      letter.textContent = r.expected.letter;
      if (r.letterMatch !== 'ok') letter.classList.add('mistake');
    }
    g.appendChild(letter);

    for (const dn of r.expected.diacritics) {
      const dia = document.createElement('span');
      dia.className = 'dia';
      dia.textContent = DIACRITIC_CHAR[dn] || '';
      if (r.diacriticMatch !== 'ok' && r.diacriticMatch !== 'n/a') dia.classList.add('mistake');
      g.appendChild(dia);
    }
    word.appendChild(g);
  }

  for (const ex of alignment.extras) {
    const exNode = document.createElement('span');
    exNode.className = 'extra mistake';
    exNode.textContent = ex.value;
    word.appendChild(exNode);
  }

  container.appendChild(word);
  container.appendChild(document.createTextNode(' '));
  return word;
}

// Render the CANONICAL verse with green highlights on letters/harakat the user got correct.
export function renderCorrectVerse(container, expectedGlyphsPerWord, wordAlignments) {
  const line = document.createElement('div');
  line.className = 'correct-line';

  for (let wi = 0; wi < expectedGlyphsPerWord.length; wi++) {
    const expectedWord = expectedGlyphsPerWord[wi];
    const alignment = wordAlignments[wi];
    const wordEl = document.createElement('span');
    wordEl.className = 'word correct-word';

    for (let gi = 0; gi < expectedWord.length; gi++) {
      const expected = expectedWord[gi];
      const r = alignment?.result?.[gi];
      const g = document.createElement('span');
      g.className = 'glyph';

      const letter = document.createElement('span');
      letter.className = 'glyph__letter';
      letter.textContent = expected.letter;
      if (r && r.letterMatch === 'ok') letter.classList.add('correct');
      g.appendChild(letter);

      for (const dn of expected.diacritics) {
        const dia = document.createElement('span');
        dia.className = 'dia';
        dia.textContent = DIACRITIC_CHAR[dn] || '';
        if (r && r.diacriticMatch === 'ok') dia.classList.add('correct');
        g.appendChild(dia);
      }
      wordEl.appendChild(g);
    }
    line.appendChild(wordEl);
    line.appendChild(document.createTextNode(' '));
  }
  container.appendChild(line);
}

export function clearVerseDisplay(container) { container.innerHTML = ''; }
