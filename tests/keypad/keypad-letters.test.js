import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeKeypadLetters } from '../../src/keypad/keypad-letters.js';
import { parseVerse } from '../../src/verse/parser.js';

test('computeKeypadLetters: includes letters from the verse', () => {
  const v = parseVerse('بِسْمِ ٱللَّهِ');
  const letters = computeKeypadLetters([v]);
  for (const ch of ['ب','س','م','ل','ه']) assert.ok(letters.includes(ch), `missing ${ch}`);
});

test('computeKeypadLetters: includes confusables', () => {
  const v = parseVerse('سَ');
  const letters = computeKeypadLetters([v]);
  for (const ch of ['ش','ص','ث']) assert.ok(letters.includes(ch), `confusable ${ch} missing`);
});

test('computeKeypadLetters: empty input → empty list', () => {
  assert.deepEqual(computeKeypadLetters([]), []);
});
