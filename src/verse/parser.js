// Diacritic codepoint → semantic name
const DIACRITIC_MAP = {
  'ً': 'tanween_fath',  // ً
  'ٌ': 'tanween_damm',  // ٌ
  'ٍ': 'tanween_kasr',  // ٍ
  'َ': 'fatha',         // َ
  'ُ': 'damma',         // ُ
  'ِ': 'kasra',         // ِ
  'ّ': 'shadda',        // ّ
  'ْ': 'sukun',         // ْ
  'ٰ': 'dagger_alif'    // ٰ
};

const ALIF = 'ا';      // ا
const FATHA = 'َ';     // َ

// A character is a combining mark in Arabic if its codepoint is in
// U+064B..U+065F or U+0670..U+06ED. (These are the harakat + Quranic marks.)
function isCombiningMark(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x064B && c <= 0x065F) || (c >= 0x0670 && c <= 0x06ED);
}

export function parseWord(word) {
  const glyphs = [];
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    if (isCombiningMark(ch)) { i++; continue; } // stray mark with no base — skip
    const glyph = { letter: ch, diacritics: [], isSilent: true, isMaddAlif: false };
    i++;
    while (i < word.length && isCombiningMark(word[i])) {
      const name = DIACRITIC_MAP[word[i]];
      if (name) glyph.diacritics.push(name);
      i++;
    }
    glyphs.push(glyph);
  }
  // Apply silent + madd-alif rules in a second pass so we can look at previous glyph.
  for (let k = 0; k < glyphs.length; k++) {
    const g = glyphs[k];
    const hasMark = g.diacritics.length > 0;
    const isMaddAlif =
      g.letter === ALIF &&
      !hasMark &&
      k > 0 &&
      glyphs[k - 1].diacritics.includes('fatha');
    g.isMaddAlif = isMaddAlif;
    g.isSilent = !hasMark && !isMaddAlif;
  }
  return glyphs;
}

export function parseVerse(verseText) {
  return verseText
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseWord);
}
