import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWord } from '../../src/verse/parser.js';
import { transliterateWord, transliterateVerse } from '../../src/verse/transliterate.js';

function tl(word) { return transliterateWord(parseWord(word)); }

test('transliterate: simple word قُلْ → qul', () => {
  assert.equal(tl('قُلْ'), 'qul');
});

test('transliterate: madd alif extends fatha into ā', () => {
  assert.equal(tl('قَالَ'), 'qāla');
});

test('transliterate: definite article moon-letter (الْقَمَرُ) → al-qamaru', () => {
  assert.equal(tl('الْقَمَرُ'), 'al-qamaru');
});

test('transliterate: definite article sun-letter (الشَّمْسُ) → ash-shamsu', () => {
  assert.equal(tl('الشَّمْسُ'), 'ash-shamsu');
});

test('transliterate: tanwīn at end (كِتَابٌ) → kitābun', () => {
  assert.equal(tl('كِتَابٌ'), 'kitābun');
});

test('transliterate: dagger alif acts as ā (هَٰذَا → hādhā)', () => {
  assert.equal(tl('هَٰذَا'), 'hādhā');
});

test('transliterateVerse: whole verse → array of words', () => {
  const arr = transliterateVerse('قُلْ هُوَ');
  assert.equal(arr.length, 2);
  assert.equal(arr[0], 'qul');
});
