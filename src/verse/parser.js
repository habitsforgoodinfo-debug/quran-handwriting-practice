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

// A character is a combining mark in Arabic if its codepoint is in:
//   U+064B..U+065F (tanween/harakat block),
//   U+0670        (dagger alif), or
//   U+06D6..U+06ED (Quranic small annotations).
// Note: U+0671..U+06D5 contains base letters (e.g. ٱ alif-wasla, gc=Lo)
// and punctuation, NOT combining marks.
function isCombiningMark(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0x064B && c <= 0x065F) return true;
  if (c === 0x0670) return true;
  if (c >= 0x06D6 && c <= 0x06ED) return true;
  return false;
}

export function parseWord(word) {
  const glyphs = [];
  const codepoints = Array.from(word);
  let i = 0;
  while (i < codepoints.length) {
    const ch = codepoints[i];
    if (isCombiningMark(ch)) { i++; continue; } // stray mark with no base — skip
    const glyph = { letter: ch, diacritics: [], isSilent: true, isMaddAlif: false };
    i++;
    while (i < codepoints.length && isCombiningMark(codepoints[i])) {
      const name = DIACRITIC_MAP[codepoints[i]];
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
