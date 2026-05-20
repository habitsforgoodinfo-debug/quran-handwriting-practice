import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountPracticeView } from '../../src/ui/practice-view.js';

function setup() {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const events = { completes: [] };
  const api = mountPracticeView(root, {
    onVerseComplete: (e) => events.completes.push(e)
  });
  return { root, api, events };
}

test('practice-view: setVerse renders canonical pane with current slot glow', () => {
  const { root, api } = setup();
  api.setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: 'قُلْ' });
  const current = root.querySelectorAll('.canonical-slot--current');
  assert.equal(current.length, 1);
  assert.equal(current[0].textContent, 'ق');
});

test('practice-view: after correct letter, prior slot sealed and user pane updates', () => {
  const { root, api } = setup();
  api.setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: 'قُلْ' });
  const m = api.getMatcher();
  const r = m.tryLetter('ق');
  api.applyKeyResult(r);
  assert.ok(root.querySelectorAll('.canonical-slot--sealed').length >= 1);
  assert.ok(root.querySelector('.user-pane').textContent.includes('ق'));
});

test('practice-view: silent slots render with --silent class', () => {
  const { root, api } = setup();
  api.setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: 'قَالَ' });
  const silents = root.querySelectorAll('.canonical-slot--silent');
  assert.ok(silents.length >= 1);
});

test('practice-view: setVerse with empty rawText clears panes', () => {
  const { root, api } = setup();
  api.setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: 'قُلْ' });
  api.setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: '' });
  assert.equal(root.querySelectorAll('.canonical-slot').length, 0);
});

test('practice-view: first verse uses isVerseStart=true (leading ٱ becomes sound)', () => {
  const { root, api } = setup();
  api.setVerse({ surah: 1, surahName: 'Test', ayah: 2, rawText: 'ٱلْحَمْدُ' });
  const current = root.querySelectorAll('.canonical-slot--current')[0];
  assert.equal(current?.textContent, 'ٱ');
});

test('practice-view: hasInProgressInput tracks whether any sound was typed', () => {
  const { api } = setup();
  api.setVerse({ surah: 1, surahName: 'Test', ayah: 1, rawText: 'قُلْ' });
  assert.equal(api.hasInProgressInput(), false);
  const r = api.getMatcher().tryLetter('ق');
  api.applyKeyResult(r);
  assert.equal(api.hasInProgressInput(), true);
});

test('practice-view: showRangeEnd renders banner with provided buttons', () => {
  const { root, api } = setup();
  let clicked = 0;
  api.showRangeEnd([{ label: 'Practice again', onClick: () => clicked++ }]);
  const btn = root.querySelectorAll('.banner-btn')[0];
  assert.ok(btn);
  btn.dispatch('click');
  assert.equal(clicked, 1);
});
