import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountKeypad } from '../../src/ui/keypad.js';

function setup(script = 'uthmani') {
  const doc = makeDocument();
  globalThis.document = doc;
  const root = doc.createElement('div');
  const calls = { letter: [], harakat: [], backspace: 0, audio: 0 };
  const api = mountKeypad(root, {
    onLetter:    (c) => calls.letter.push(c),
    onHarakat:   (c) => calls.harakat.push(c),
    onBackspace: () => calls.backspace++,
    onPlayAudio: () => calls.audio++
  }, { script });
  return { root, api, calls };
}

test('keypad: tapping a letter fires onLetter', () => {
  const { root, calls } = setup();
  const qaf = root.querySelectorAll('.key--letter').find(b => b.textContent === 'ق');
  qaf.dispatch('click');
  assert.deepEqual(calls.letter, ['ق']);
});

test('keypad: tapping a harakat fires onHarakat with combining char', () => {
  const { root, calls } = setup();
  const fatha = root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('َ'));
  fatha.dispatch('click');
  assert.deepEqual(calls.harakat, ['َ']);
});

test('keypad: ⌫ fires onBackspace, ▶ fires onPlayAudio', () => {
  const { root, calls } = setup();
  const back  = root.querySelectorAll('.key--action').find(b => b.textContent === '⌫');
  const audio = root.querySelectorAll('.key--action').find(b => b.textContent.includes('▶'));
  back.dispatch('click');
  audio.dispatch('click');
  assert.equal(calls.backspace, 1);
  assert.equal(calls.audio, 1);
});

test('keypad: no Submit / Space / Clear / extras row', () => {
  const { root } = setup();
  const labels = root.querySelectorAll('.key').map(b => b.textContent);
  assert.ok(!labels.some(l => /submit/i.test(l)));
  assert.ok(!labels.some(l => /space/i.test(l) || l === ' '));
  assert.ok(!labels.some(l => /clear/i.test(l)));
  assert.equal(root.querySelectorAll('.keypad-extras').length, 0);
});

test('keypad: setHint({letter}) glows exactly that letter key', () => {
  const { root, api } = setup();
  api.setHint({ letter: 'ق' });
  const glowing = root.querySelectorAll('.key--glow');
  assert.equal(glowing.length, 1);
  assert.equal(glowing[0].textContent, 'ق');
});

test('keypad: setHint({letter, harakat}) glows both', () => {
  const { root, api } = setup();
  api.setHint({ letter: 'ق', harakat: 'َ' });
  assert.equal(root.querySelectorAll('.key--glow').length, 2);
});

test('keypad: setHint({}) clears all glow', () => {
  const { root, api } = setup();
  api.setHint({ letter: 'ق' });
  api.setHint({});
  assert.equal(root.querySelectorAll('.key--glow').length, 0);
});

test('keypad: flashWrong adds .shake to matching key', () => {
  const { root, api } = setup();
  api.flashWrong('ك');
  const kaf = root.querySelectorAll('.key--letter').find(b => b.textContent === 'ك');
  assert.ok(kaf.classList.contains('shake'));
});

test('keypad: dagger-alif key exists on harakat row and fires onHarakat with ٰ', () => {
  const { root, calls } = setup();
  const k = root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('ٰ'));
  assert.ok(k, 'dagger-alif key missing');
  k.dispatch('click');
  assert.deepEqual(calls.harakat, ['ٰ']);
});

test('keypad: madda key exists on harakat row and fires onHarakat with ٓ', () => {
  const { root, calls } = setup();
  const k = root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('ٓ'));
  assert.ok(k, 'madda key missing');
  k.dispatch('click');
  assert.deepEqual(calls.harakat, ['ٓ']);
});

test('keypad: → next ayah action key fires onNextAyah', () => {
  const doc = makeDocument();
  globalThis.document = doc;
  const root = doc.createElement('div');
  const calls = { next: 0 };
  mountKeypad(root, {
    onLetter: () => {}, onHarakat: () => {}, onBackspace: () => {},
    onPlayAudio: () => {}, onNextAyah: () => calls.next++
  });
  const nextBtn = root.querySelectorAll('.key--action').find(b => /next/i.test(b.textContent));
  assert.ok(nextBtn);
  nextBtn.dispatch('click');
  assert.equal(calls.next, 1);
});

test('keypad: harakat row has exactly 10 keys', () => {
  const { root } = setup();
  assert.equal(root.querySelectorAll('.key--harakah').length, 10);
});

test('keypad: indopak script displays jazm sukun (ۡ) but still fires canonical ْ', () => {
  const doc = makeDocument();
  globalThis.document = doc;
  const root = doc.createElement('div');
  const calls = { harakat: [] };
  mountKeypad(root, { onHarakat: c => calls.harakat.push(c) }, { script: 'indopak' });
  const k = root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('ۡ'));
  assert.ok(k, 'jazm key (ۡ) should display in indopak mode');
  k.dispatch('click');
  // Handler still receives the canonical ْ so the matcher accepts either form.
  assert.deepEqual(calls.harakat, ['ْ']);
});

test('keypad: setScript swaps the sukun glyph live', () => {
  const doc = makeDocument();
  globalThis.document = doc;
  const root = doc.createElement('div');
  const api = mountKeypad(root, { onHarakat: () => {} }, { script: 'uthmani' });
  assert.ok(root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('ْ')));
  api.setScript('indopak');
  assert.ok(root.querySelectorAll('.key--harakah').find(b => b.textContent.includes('ۡ')));
});
