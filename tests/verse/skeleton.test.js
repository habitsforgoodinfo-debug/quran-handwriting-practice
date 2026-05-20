import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkeleton } from '../../src/verse/skeleton.js';

function kinds(slots) { return slots.map(s => s.kind); }
function reqSet(slot) { return new Set(slot.expectedHarakat.required || []); }

test('skeleton: simple verse — sound + wordEnd per word', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  assert.deepEqual(kinds(slots), ['sound','sound','wordEnd','sound','sound','wordEnd']);
  assert.deepEqual(reqSet(slots[0]), new Set(['damma']));
  assert.deepEqual(reqSet(slots[1]), new Set(['sukun']));
});

test('skeleton: madd alif is a sound slot with hasNone (user types it)', () => {
  const slots = buildSkeleton('قَالَ');
  assert.deepEqual(kinds(slots), ['sound','sound','sound','wordEnd']);
  const alif = slots[1];
  assert.equal(alif.letter, 'ا');
  assert.equal(alif.expectedHarakat.hasNone, true);
});

test('skeleton: shadda + fatha → required contains both', () => {
  const slots = buildSkeleton('إِنَّا');
  const nun = slots.find(s => s.letter === 'ن');
  assert.deepEqual(reqSet(nun), new Set(['shadda','fatha']));
});

test('skeleton: shadda + dagger_alif (لَّٰ) → required contains both', () => {
  const slots = buildSkeleton('ٱللَّٰهِ');
  const shaddaLam = slots.find(s => s.letter === 'ل' && s.expectedHarakat.required?.includes('shadda'));
  assert.ok(shaddaLam, 'should find a lam with shadda');
  const req = shaddaLam.expectedHarakat.required;
  assert.ok(req.includes('shadda'), 'should include shadda');
  assert.ok(req.includes('dagger_alif'), 'should include dagger_alif');
});

test('skeleton: sun-letter article — alif and lam both silent', () => {
  const slots = buildSkeleton('الشَّمْسِ');
  assert.deepEqual(kinds(slots).slice(0, 5), ['silent','silent','sound','sound','sound']);
});

test('skeleton: wordIdx tracks words', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  const w0 = slots.filter(s => s.wordIdx === 0 && s.kind !== 'wordEnd');
  const w1 = slots.filter(s => s.wordIdx === 1 && s.kind !== 'wordEnd');
  assert.equal(w0.length, 2);
  assert.equal(w1.length, 2);
});

test('skeleton: bare sound slot (no marks) has hasNone=true and required is empty', () => {
  const slots = buildSkeleton('ة');
  const s = slots.find(x => x.kind === 'sound' || x.kind === 'silent');
  assert.ok(s);
  assert.equal(s.expectedHarakat.hasNone, true);
  assert.deepEqual(reqSet(s), new Set());
});

test('skeleton: isVerseStart=true → leading alif-wasla becomes sound with required=[fatha]', () => {
  const slots = buildSkeleton('ٱلْحَمْدُ', { isVerseStart: true });
  assert.equal(slots[0].kind, 'sound');
  assert.equal(slots[0].letter, 'ٱ');
  assert.deepEqual(reqSet(slots[0]), new Set(['fatha']));
});

test('skeleton: isVerseStart=true → leading bare alif also gets fatha', () => {
  const slots = buildSkeleton('الْحَمْدُ', { isVerseStart: true });
  assert.equal(slots[0].kind, 'sound');
  assert.deepEqual(reqSet(slots[0]), new Set(['fatha']));
});

test('skeleton: isVerseStart defaults false → alif-wasla stays silent', () => {
  const slots = buildSkeleton('ٱلْحَمْدُ');
  assert.equal(slots[0].kind, 'silent');
});

test('skeleton: last sound slot of verse carries acceptWaqf=true', () => {
  const slots = buildSkeleton('قُلْ هُوَ');
  const soundSlots = slots.filter(s => s.kind === 'sound');
  const last = soundSlots[soundSlots.length - 1];
  assert.equal(last.acceptWaqf, true);
  const others = soundSlots.slice(0, -1);
  for (const s of others) assert.notEqual(s.acceptWaqf, true);
});

test('skeleton: Indo-Pak sukun glyph (ۡ) normalized to required=[sukun]', () => {
  // بِسۡمِ — س has ۡ (high_dotless_head_of_khah → sukun)
  const slots = buildSkeleton('بِسۡمِ');
  const seen = slots.find(s => s.letter === 'س');
  assert.ok(seen);
  assert.ok(new Set(seen.expectedHarakat.required).has('sukun'));
});

test('skeleton: pause marks (e.g. ۙ) go into ornaments not required', () => {
  // Construct a verse with the high_lam pause mark.
  const slots = buildSkeleton('قُلْۙ');
  const lam = slots.find(s => s.letter === 'ل');
  assert.ok(lam);
  // sukun stays required; the pause becomes ornament-only
  assert.ok(new Set(lam.expectedHarakat.required).has('sukun'));
  assert.ok((lam.expectedHarakat.ornaments || []).includes('high_lam'));
});
