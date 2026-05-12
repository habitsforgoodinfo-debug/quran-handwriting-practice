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

export function renderWord(container, alignment, { silentColorOn = true } = {}) {
  const word = document.createElement('span');
  word.className = 'word';
  for (const r of alignment.result) {
    const g = document.createElement('span');
    g.className = `glyph glyph--${r.letterMatch}`;
    if (r.letterMatch === 'autofill' && silentColorOn) g.classList.add('glyph--silent-visible');

    const letter = document.createElement('span');
    letter.className = 'glyph__letter';
    letter.textContent = r.expected.letter;
    g.appendChild(letter);

    for (const dn of r.expected.diacritics) {
      const dia = document.createElement('span');
      dia.className = `dia dia--${r.diacriticMatch}`;
      dia.textContent = DIACRITIC_CHAR[dn] || '';
      g.appendChild(dia);
    }
    word.appendChild(g);
  }

  for (const ex of alignment.extras) {
    const exNode = document.createElement('span');
    exNode.className = `extra extra--${ex.kind}`;
    exNode.textContent = ex.value;
    word.appendChild(exNode);
  }

  container.appendChild(word);
  container.appendChild(document.createTextNode(' '));
  return word;
}

export function clearVerseDisplay(container) {
  container.innerHTML = '';
}
