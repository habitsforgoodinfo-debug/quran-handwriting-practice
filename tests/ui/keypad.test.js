import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountKeypad } from '../../src/ui/keypad.js';

function setup() {
  const doc = makeDocument();
  globalThis.document = doc;
  const root = doc.createElement('div');
  const calls = { letter: [], harakat: [], backspace: 0, audio: 0 };
  const api = mountKeypad(root, {
    onLetter:    (c) => calls.letter.push(c),
    onHarakat:   (c) => calls.harakat.push(c),
    onBackspace: () => calls.backspace++,
    onPlayAudio: () => calls.audio++
  });
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
