import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkeleton } from '../../src/verse/skeleton.js';

function kinds(slots) { return slots.map(s => s.kind); }

test('skeleton: simple verse — sound slots + wordEnd marker per word', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  assert.deepEqual(kinds(slots), ['sound','sound','wordEnd','sound','sound','wordEnd']);
  assert.equal(slots[0].letter, 'ق');
  assert.deepEqual(slots[0].expectedHarakat, { vowel: 'damma' });
  assert.equal(slots[1].letter, 'ل');
  assert.deepEqual(slots[1].expectedHarakat, { vowel: 'sukun' });
});

test('skeleton: madd alif becomes silent slot', () => {
  const slots = buildSkeleton('قَالَ');
  assert.deepEqual(kinds(slots), ['sound','silent','sound','wordEnd']);
  assert.equal(slots[1].letter, 'ا');
});

test('skeleton: shadda + fatha → expectedHarakat has both', () => {
  const slots = buildSkeleton('إِنَّا');
  const nun = slots.find(s => s.letter === 'ن');
  assert.deepEqual(nun.expectedHarakat, { shadda: true, vowel: 'fatha' });
});

test('skeleton: sun-letter article — alif and lam both silent', () => {
  const slots = buildSkeleton('الشَّمْسِ');
  assert.deepEqual(
    kinds(slots).slice(0, 5),
    ['silent','silent','sound','sound','sound']
  );
});

test('skeleton: wordIdx increases per word', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  const w0 = slots.filter(s => s.wordIdx === 0 && s.kind !== 'wordEnd');
  const w1 = slots.filter(s => s.wordIdx === 1 && s.kind !== 'wordEnd');
  assert.equal(w0.length, 2);
  assert.equal(w1.length, 2);
});
