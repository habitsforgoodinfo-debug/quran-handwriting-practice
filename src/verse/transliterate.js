// Generates a Latin transliteration for any Quran word from its parsed
// glyph list. The output is intentionally simple/standard — perfect
// Quranic transliteration (with ʾiʿrāb endings, idafa, waqf forms, etc.)
// is out of scope. This covers ~90% of cases well enough that a learner
// can read along.

import { parseVerse } from './parser.js';

const LETTER_TL = {
  'ا': 'ā', 'ٱ': '',
  'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'ḥ', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 'ṣ', 'ض': 'ḍ',
  'ط': 'ṭ', 'ظ': 'ẓ', 'ع': 'ʿ', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l',
  'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'ء': 'ʾ', 'ة': 'h', 'ى': 'ā',
  'أ': 'ʾa', 'إ': 'ʾi', 'ؤ': 'ʾu', 'ئ': 'ʾi', 'آ': 'ʾā',
  'لا': 'lā'
};

const VOWEL_TL = {
  fatha: 'a', kasra: 'i', damma: 'u', sukun: '',
  tanween_fath: 'an', tanween_kasr: 'in', tanween_damm: 'un',
  dagger_alif: 'ā', maddah_above: '', high_madda: ''
};

// Sun letters absorb the lam of the definite article. We replace the
// resulting "l + shadda'd sun-letter" with the sun-letter doubled.
const SUN_LETTERS = new Set([
  'ت','ث','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ل','ن'
]);

export function transliterateWord(glyphs) {
  let out = '';

  // Detect definite article: leading ا/ٱ + ل (silent both).
  let i = 0;
  let skipSunDoubling = false;
  if (glyphs.length >= 2
      && (glyphs[0].letter === 'ا' || glyphs[0].letter === 'ٱ')
      && glyphs[0].isSilent
      && glyphs[1].letter === 'ل') {
    if (glyphs[2] && SUN_LETTERS.has(glyphs[2].letter)
        && glyphs[2].diacritics.includes('shadda')) {
      const sun = LETTER_TL[glyphs[2].letter] || glyphs[2].letter;
      out += 'a' + sun + '-';
      skipSunDoubling = true; // don't double the sun letter again inside the body
    } else {
      out += 'al-';
    }
    i = 2;
  }

  for (; i < glyphs.length; i++) {
    const g = glyphs[i];

    if (g.isSilent) continue;

    // Madd alif: already absorbed by the previous glyph's vowel as ā.
    if (g.isMaddAlif) continue;

    const baseTl = LETTER_TL[g.letter] ?? g.letter;
    let segment = baseTl;
    if (g.diacritics.includes('shadda') && !skipSunDoubling) segment += baseTl;
    skipSunDoubling = false;

    const vowelName = g.diacritics.find(d => d in VOWEL_TL && d !== 'sukun'
                                       && d !== 'maddah_above'
                                       && d !== 'high_madda');
    const next = glyphs[i + 1];
    let vowel = vowelName ? VOWEL_TL[vowelName] : '';
    if (next && next.isMaddAlif && vowelName === 'fatha') vowel = 'ā';
    else if (next && next.letter === 'و' && next.isSilent && vowelName === 'damma') vowel = 'ū';
    else if (next && next.letter === 'ي' && next.isSilent && vowelName === 'kasra') vowel = 'ī';

    if (g.diacritics.includes('dagger_alif')) vowel = 'ā';

    out += segment + vowel;
  }

  return out;
}

export function transliterateVerse(rawText) {
  return parseVerse(rawText).map(transliterateWord);
}
