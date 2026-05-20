// Diacritic codepoint → semantic name. Covers every combining mark actually
// present in the bundled Indo-Pak and Uthmani data (see scripts/scan-marks.js).
const DIACRITIC_MAP = {
  // standard harakat / tanween (U+064B..U+0652)
  'ً': 'tanween_fath',
  'ٌ': 'tanween_damm',
  'ٍ': 'tanween_kasr',
  'َ': 'fatha',
  'ُ': 'damma',
  'ِ': 'kasra',
  'ّ': 'shadda',
  'ْ': 'sukun',
  // additional letter marks
  'ٓ': 'maddah_above',      // U+0653
  'ٔ': 'hamza_above',       // U+0654
  'ٕ': 'hamza_below',       // U+0655
  'ٖ': 'mark_0656',         // U+0656 (Indo-Pak small low kasra-like)
  'ٗ': 'mark_0657',         // U+0657 (Indo-Pak inverted damma)
  '٘': 'mark_0658',         // U+0658 (Indo-Pak mark noon ghunna)
  'ٜ': 'mark_065C',         // U+065C
  'ٰ': 'dagger_alif',       // U+0670
  // small high Quranic annotations (U+06D6..U+06ED)
  'ۖ': 'high_ligature_sad_lam',                 // U+06D6
  'ۗ': 'high_qaf_lam',                          // U+06D7
  'ۘ': 'high_meem_initial',                     // U+06D8
  'ۙ': 'high_lam',                              // U+06D9
  'ۚ': 'high_jeem',                             // U+06DA
  'ۛ': 'high_three_dots',                       // U+06DB
  'ۜ': 'high_seen',                             // U+06DC
  '۞': 'rub_el_hizb',                           // U+06DE (not strictly combining but encountered)
  '۠': 'high_upright_rectangular_zero',         // U+06E0
  'ۡ': 'high_dotless_head_of_khah',             // U+06E1 (Indo-Pak sukun substitute)
  'ۢ': 'high_meem_isolated',                    // U+06E2
  'ۤ': 'high_madda',                            // U+06E4
  'ۥ': 'small_waw',                             // U+06E5
  'ۦ': 'small_yeh',                             // U+06E6
  'ۧ': 'small_high_yeh',                        // U+06E7
  'ۨ': 'small_high_noon',                       // U+06E8
  '۩': 'place_of_sajdah',                       // U+06E9
  '۬': 'rounded_high_stop_with_filled_centre',  // U+06EC
  'ۭ': 'small_low_meem'                         // U+06ED
};

// Reverse map: name → char. Used by renderer and user-stream modules.
const DIACRITIC_CHAR = Object.fromEntries(
  Object.entries(DIACRITIC_MAP).map(([ch, name]) => [name, ch])
);

const ALIF = 'ا';      // ا

// A character is a combining mark in Arabic if its codepoint is in:
//   U+064B..U+065F (tanween/harakat block),
//   U+0670        (dagger alif), or
//   U+06D6..U+06ED (Quranic small annotations).
// Note: U+0671..U+06D5 contains base letters (e.g. ٱ alif-wasla, gc=Lo)
// and punctuation, NOT combining marks.
function isCombiningMark(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0x0610 && c <= 0x061A) return true; // Arabic small high marks
  if (c >= 0x064B && c <= 0x065F) return true; // harakat block
  if (c === 0x0670) return true;               // superscript alif
  if (c >= 0x06D6 && c <= 0x06ED) return true; // small high Quranic annotations
  if (c >= 0x08D3 && c <= 0x08FF) return true; // Arabic Extended-A combining marks
  return false;
}

// Zero-width / bidi formatting characters that must be stripped before
// parsing — otherwise they appear as phantom base letters that the user
// can never type, blocking verse completion. Indo-Pak data appends U+200F
// (right-to-left mark) at the end of every verse.
const FORMATTING_RE = /[​-‏‪-‮⁦-⁩﻿]/g;
function stripFormatting(s) {
  return s.replace(FORMATTING_RE, '');
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
  return stripFormatting(verseText)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseWord);
}

// Exported for use by user-stream and renderer modules.
export { isCombiningMark };
export const _diacriticMapForUserStream = DIACRITIC_MAP;
export const _diacriticCharByName = DIACRITIC_CHAR;
