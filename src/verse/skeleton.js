import { parseVerse } from './parser.js';
import { isSilentInWord } from './silent-rules.js';

const VOWELS = new Set(['fatha','kasra','damma','sukun',
  'tanween_fath','tanween_kasr','tanween_damm']);

function harakatFor(glyph) {
  const shadda = glyph.diacritics.includes('shadda');
  const vowel = glyph.diacritics.find(d => VOWELS.has(d));
  const extra = glyph.diacritics.filter(d => d !== 'shadda' && !VOWELS.has(d));
  if (!shadda && !vowel) {
    const out = { none: true };
    if (extra.length) out.extra = extra;
    return out;
  }
  const out = {};
  if (shadda) out.shadda = true;
  if (vowel)  out.vowel  = vowel;
  if (extra.length) out.extra = extra;
  return out;
}

export function buildSkeleton(rawVerse) {
  const words = parseVerse(rawVerse);
  const slots = [];
  let canonicalIdx = 0;
  for (let wi = 0; wi < words.length; wi++) {
    const glyphs = words[wi];
    for (let gi = 0; gi < glyphs.length; gi++) {
      const g = glyphs[gi];
      const silent = isSilentInWord(glyphs, gi);
      slots.push({
        kind: silent ? 'silent' : 'sound',
        letter: g.letter,
        expectedHarakat: harakatFor(g),
        wordIdx: wi,
        canonicalIdx: canonicalIdx++
      });
    }
    slots.push({ kind: 'wordEnd', wordIdx: wi });
  }
  return slots;
}
