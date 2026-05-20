import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWord } from '../../src/verse/parser.js';
import { isSilentInWord } from '../../src/verse/silent-rules.js';

function silentMap(word) {
  const glyphs = parseWord(word);
  return glyphs.map((_, i) => isSilentInWord(glyphs, i));
}

test('silent-rules: sun-letter alif after definite article (الشَّمْس)', () => {
  const m = silentMap('الشَّمْسِ');
  assert.equal(m[0], true);
  assert.equal(m[1], true);
});

test('silent-rules: moon-letter lam after definite article (الْقَمَر) — lam pronounced', () => {
  const m = silentMap('الْقَمَرِ');
  assert.equal(m[0], true);
  assert.equal(m[1], false);
});

test('silent-rules: plural-masculine alif (كَتَبُوا) — final alif silent', () => {
  const m = silentMap('كَتَبُوا');
  assert.equal(m[m.length - 1], true);
});

test('silent-rules: madd alif (قَالَ) — alif is SOUND (user types it)', () => {
  const glyphs = parseWord('قَالَ');
  assert.equal(isSilentInWord(glyphs, 1), false);
});

test('silent-rules: ordinary letter with harakat is NOT silent', () => {
  const m = silentMap('قَالَ');
  assert.equal(m[0], false);
  assert.equal(m[2], false);
});

test('silent-rules: dagger alif is a combining mark, not a glyph', () => {
  const glyphs = parseWord('هَٰذَا');
  assert.ok(glyphs.every(g => g.letter !== 'ٰ'));
});

import { firstSoundOverride } from '../../src/verse/silent-rules.js';

test('firstSoundOverride: alif-wasla at verse start → fatha', () => {
  const glyphs = parseWord('ٱلْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 0, true), 'fatha');
});

test('firstSoundOverride: bare alif at verse start with no vowel → fatha', () => {
  const glyphs = parseWord('الْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 0, true), 'fatha');
});

test('firstSoundOverride: alif-wasla NOT at verse start → null', () => {
  const glyphs = parseWord('ٱلْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 0, false), null);
});

test('firstSoundOverride: leading letter with diacritic → null', () => {
  const glyphs = parseWord('قَالَ');
  assert.equal(firstSoundOverride(glyphs, 0, true), null);
});

test('firstSoundOverride: only fires at index 0', () => {
  const glyphs = parseWord('ٱلْحَمْدُ');
  assert.equal(firstSoundOverride(glyphs, 1, true), null);
});

test('silent-rules: madd alif followed by letter with sukun → silent', () => {
  // قَالْ-style — alif then ل with sukun. Alif elongation is dropped.
  const glyphs = parseWord('قَالْ');
  assert.equal(isSilentInWord(glyphs, 1), true);
});

test('silent-rules: madd alif followed by letter with shadda → silent', () => {
  // ضَآلِّ — alif then لّ (shadda). Alif drops out of pronunciation.
  // Constructing a minimal example: حَاطَّ-like
  const glyphs = parseWord('ضَالَّ');
  assert.equal(isSilentInWord(glyphs, 1), true);
});

test('silent-rules: madd alif followed by plain letter → sound (user types)', () => {
  const glyphs = parseWord('قَالَ');
  assert.equal(isSilentInWord(glyphs, 1), false);
});
