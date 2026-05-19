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

function harakatFor(glyph, extraRequired = []) {
  const required = [];
  for (const d of glyph.diacritics) {
    if (GATED_DIACRITICS.has(d) && !required.includes(d)) required.push(d);
  }
  for (const d of extraRequired) {
    if (!required.includes(d)) required.push(d);
  }
  const ornaments = glyph.diacritics.filter(d => !GATED_DIACRITICS.has(d));
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

  return slots;
}
