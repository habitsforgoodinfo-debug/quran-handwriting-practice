import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountPracticeView } from '../../src/ui/practice-view.js';

function setup() {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const events = { complete: 0 };
  const api = mountPracticeView(root, { onAllVersesComplete: () => events.complete++ });
  return { root, api, events };
}

test('practice-view: setVerses renders canonical pane with current slot glow', () => {
  const { root, api } = setup();
  api.setVerses(['قُلْ']);
  const current = root.querySelectorAll('.canonical-slot--current');
  assert.equal(current.length, 1);
  assert.equal(current[0].textContent, 'ق');
});

test('practice-view: after correct letter, prior slot sealed and user pane updates', () => {
  const { root, api } = setup();
  api.setVerses(['قُلْ']);
  const m = api.getMatcher();
  const r = m.tryLetter('ق');
  api.applyKeyResult(r);
  assert.ok(root.querySelectorAll('.canonical-slot--sealed').length >= 1);
  assert.ok(root.querySelector('.user-pane').textContent.includes('ق'));
});

test('practice-view: silent slots render with --silent class', () => {
  const { root, api } = setup();
  api.setVerses(['قَالَ']);
  const silents = root.querySelectorAll('.canonical-slot--silent');
  assert.ok(silents.length >= 1);
});

test('practice-view: setVerses to empty array clears panes', () => {
  const { root, api } = setup();
  api.setVerses(['قُلْ']);
  api.setVerses([]);
  assert.equal(root.querySelectorAll('.canonical-slot').length, 0);
});
