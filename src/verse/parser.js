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
  'ٖ': 'subscript_alef',    // U+0656 — Indo-Pak long-kasra
  'ٗ': 'inverted_damma',    // U+0657 — Indo-Pak long-damma
  '٘': 'mark_0658',         // U+0658 (Indo-Pak noon ghunna marker)
  'ٚ': 'small_v_above',     // U+065A — Indo-Pak imala marker
  'ٜ': 'mark_065C',         // U+065C
  // Small high marks U+0610..U+061A (Tarteel data uses U+0614, U+0615, U+0617)
  'ؔ': 'small_high_tah_v2', // U+0614
  'ؕ': 'small_high_tah',    // U+0615
  'ؗ': 'small_high_zayn',   // U+0617
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
  '۟': 'small_high_rounded_zero',               // U+06DF — Indo-Pak silent-letter marker
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
// Private-use-area chars sometimes leak in from typesetting tools (the
// Tarteel Indo-Pak source has scattered U+F500 markers). They are not
// part of the Quranic text and must be dropped before parsing.
const PUA_RE = /[-]/g;
// U+0640 (ـ kashida / tatweel) is a typographic stretch char used to
// extend a letter visually — never an input from the user.
const KASHIDA_RE = /ـ/g;
function stripFormatting(s) {
  return s.replace(FORMATTING_RE, '').replace(PUA_RE, '').replace(KASHIDA_RE, '');
}

// What to drop when *displaying* an already-written verse back to the
// user (rolling strip, My Book). Removes:
//   - Private-use-area glyphs (font-specific verse-number ornaments that
//     render as tofu in most system fonts)
//   - Quranic small-high annotations like U+06D6..U+06ED (silent-letter
//     markers, waqf signs, etc.) — useful while parsing, but visually
//     noisy as tiny boxes when reading the verse back.
const DISPLAY_STRIP_RE = /[ۖ-ۭ-]/g;
export function cleanVerseForDisplay(s) {
  if (!s) return s;
  return s.replace(DISPLAY_STRIP_RE, '').replace(/\s+/g, ' ').trim();
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
    .map(parseWord)
    // The Tarteel Indo-Pak data emits pause / sajdah markers as their
    // own "words" (e.g. " ۟ۙ"). After parsing those produce zero glyphs;
    // drop them so the matcher doesn't see empty word slots.
    .filter(glyphs => glyphs.length > 0);
}

// Exported for use by user-stream and renderer modules.
export { isCombiningMark };
export const _diacriticMapForUserStream = DIACRITIC_MAP;
export const _diacriticCharByName = DIACRITIC_CHAR;
