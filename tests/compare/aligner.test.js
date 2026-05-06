import { test } from 'node:test';
import assert from 'node:assert/strict';
import { align } from '../../src/compare/aligner.js';
import { parseWord } from '../../src/verse/parser.js';

test('aligner: all correct → all ok', () => {
  const expected = parseWord('كَ');
  const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
  const { result, extras } = align(expected, recognized);
  assert.equal(result.length, 1);
  assert.equal(result[0].letterMatch, 'ok');
  assert.equal(result[0].diacriticMatch, 'ok');
  assert.deepEqual(extras, []);
});

test('aligner: wrong letter is flagged', () => {
  const expected = parseWord('كَ');
  const recognized = { letters: [{ matchedLetter: 'ل', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
  const { result } = align(expected, recognized);
  assert.equal(result[0].letterMatch, 'wrong');
  assert.equal(result[0].diacriticMatch, 'ok');
});

test('aligner: wrong harakah is flagged', () => {
  const expected = parseWord('كَ');
  const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: ['kasra'] };
  const { result } = align(expected, recognized);
  assert.equal(result[0].letterMatch, 'ok');
  assert.equal(result[0].diacriticMatch, 'wrong');
});

test('aligner: silent letter is autofilled — never wrong', () => {
  const expected = parseWord('كَل');
  const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
  const { result, extras } = align(expected, recognized);
  assert.equal(result[0].letterMatch, 'ok');
  assert.equal(result[1].letterMatch, 'autofill');
  assert.deepEqual(extras, []);
});

test('aligner: madd-alif is required (not silent)', () => {
  const expected = parseWord('قَال');
  const recognized = { letters: [{ matchedLetter: 'ق', confidence: 0.9, unclear: false }], diacritics: ['fatha'] };
  const { result } = align(expected, recognized);
  assert.equal(result[0].letterMatch, 'ok');
  assert.equal(result[1].letterMatch, 'missing');
  assert.equal(result[2].letterMatch, 'autofill');
});

test('aligner: extra letters are reported in extras', () => {
  const expected = parseWord('كَ');
  const recognized = {
    letters: [
      { matchedLetter: 'ك', confidence: 0.9, unclear: false },
      { matchedLetter: 'ت', confidence: 0.9, unclear: false }
    ],
    diacritics: ['fatha']
  };
  const { extras } = align(expected, recognized);
  assert.deepEqual(extras, [{ kind: 'letter', value: 'ت' }]);
});

test('aligner: low-confidence cluster → unclear', () => {
  const expected = parseWord('كَ');
  const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.05, unclear: true }], diacritics: ['fatha'] };
  const { result } = align(expected, recognized);
  assert.equal(result[0].letterMatch, 'unclear');
});

test('aligner: missing diacritic when expected has one', () => {
  const expected = parseWord('كَ');
  const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: [] };
  const { result } = align(expected, recognized);
  assert.equal(result[0].diacriticMatch, 'missing');
});

test('aligner: extra diacritic past expected is reported', () => {
  const expected = parseWord('كَ');
  const recognized = { letters: [{ matchedLetter: 'ك', confidence: 0.9, unclear: false }], diacritics: ['fatha', 'kasra'] };
  const { extras } = align(expected, recognized);
  assert.deepEqual(extras.find(e => e.kind === 'diacritic'), { kind: 'diacritic', value: 'kasra' });
});
