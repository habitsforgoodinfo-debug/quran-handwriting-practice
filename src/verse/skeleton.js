import { parseVerse } from './parser.js';
import { isSilentInWord, firstSoundOverride } from './silent-rules.js';

const GATED_DIACRITICS = new Set([
  'fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm',
  'shadda',
  'dagger_alif',
  'maddah_above',
  'high_madda'
]);

// Indo-Pak script substitutes — they mean the same sound as their canonical
// counterpart, so the matcher should require the canonical name (and accept
// either codepoint as input — handled in live-matcher.js).
const DIACRITIC_ALIASES = {
  high_dotless_head_of_khah: 'sukun', // U+06E1 (Indo-Pak sukun)
  high_madda: 'maddah_above'          // U+06E4 (Indo-Pak madda)
};

// Pause / stop annotations a renderer should show after the letter even
// though they are not user-typed.
const PAUSE_MARKS = new Set([
  'high_ligature_sad_lam', // ۖ
  'high_qaf_lam',          // ۗ
  'high_meem_initial',     // ۘ
  'high_lam',              // ۙ
  'high_jeem',             // ۚ
  'high_three_dots',       // ۛ
  'high_seen',             // ۜ
  'place_of_sajdah',       // ۩
  'rub_el_hizb',           // ۞
  'rounded_high_stop_with_filled_centre' // ۬
]);

function normalize(d) { return DIACRITIC_ALIASES[d] || d; }

function harakatFor(glyph, extraRequired = []) {
  const required = [];
  const ornaments = [];
  for (const d of glyph.diacritics) {
    const n = normalize(d);
    if (GATED_DIACRITICS.has(n)) {
      if (!required.includes(n)) required.push(n);
    } else {
      ornaments.push(d);
    }
  }
  for (const d of extraRequired) {
    if (!required.includes(d)) required.push(d);
  }
  const out = { required };
  if (required.length === 0) out.hasNone = true;
  if (ornaments.length) out.ornaments = ornaments;
  return out;
}

export function buildSkeleton(rawVerse, { isVerseStart = false } = {}) {
  const words = parseVerse(rawVerse);
  const slots = [];
  let canonicalIdx = 0;

  for (let wi = 0; wi < words.length; wi++) {
    const glyphs = words[wi];
    for (let gi = 0; gi < glyphs.length; gi++) {
      const g = glyphs[gi];
      const isFirstOfVerse = wi === 0 && gi === 0;
      const override = isFirstOfVerse
        ? firstSoundOverride(glyphs, gi, isVerseStart)
        : null;

      let silent = isSilentInWord(glyphs, gi);
      const extra = [];
      if (override) {
        silent = false;
        extra.push(override);
      }

      slots.push({
        kind: silent ? 'silent' : 'sound',
        letter: g.letter,
        expectedHarakat: harakatFor(g, extra),
        wordIdx: wi,
        canonicalIdx: canonicalIdx++
      });
    }
    slots.push({ kind: 'wordEnd', wordIdx: wi });
  }

  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].kind === 'sound') {
      slots[i].acceptWaqf = true;
      break;
    }
  }

  // If the very first sound slot of the verse carries a shadda, drop it
  // from the required marks — at the start of an utterance you can't
  // pronounce a doubled consonant from silence, so the shadda is
  // effectively ignored in recitation.
  if (isVerseStart) {
    const firstSound = slots.find(s => s.kind === 'sound');
    if (firstSound && firstSound.expectedHarakat.required?.includes('shadda')) {
      firstSound.expectedHarakat.required =
        firstSound.expectedHarakat.required.filter(d => d !== 'shadda');
      if (firstSound.expectedHarakat.required.length === 0) {
        firstSound.expectedHarakat.hasNone = true;
      }
    }
  }

  return slots;
}
