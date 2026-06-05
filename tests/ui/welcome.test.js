import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountWelcome } from '../../src/ui/screens/welcome.js';

test('welcome: mounts 3 mode tiles', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const picked = [];
  mountWelcome(root, { onPickMode: (m) => picked.push(m), onResume: () => {} });
  const tiles = root.querySelectorAll('.welcome__tile');
  assert.equal(tiles.length, 3);
});

test('welcome: tile click fires onPickMode with correct key', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const picked = [];
  mountWelcome(root, { onPickMode: (m) => picked.push(m), onResume: () => {} });
  const tiles = root.querySelectorAll('.welcome__tile');
  tiles[0].dispatch('click', {});
  tiles[1].dispatch('click', {});
  tiles[2].dispatch('click', {});
  assert.deepEqual(picked, ['refresher', 'thorough', 'dictation']);
});

test('welcome: resume link hidden by default', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const { setResume } = mountWelcome(root, { onPickMode: () => {}, onResume: () => {} });
  const link = root.querySelector('.welcome__resume');
  assert.equal(link.style.display, 'none');
  setResume('Resume - Al-Fatiha, ayah 3');
  assert.notEqual(link.style.display, 'none');
  assert.ok(link.textContent.includes('Al-Fatiha'));
});

test('welcome: setResume(null) hides link', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const { setResume } = mountWelcome(root, { onPickMode: () => {}, onResume: () => {} });
  setResume('Resume somewhere');
  setResume(null);
  const link = root.querySelector('.welcome__resume');
  assert.equal(link.style.display, 'none');
});

test('welcome: onResume fires when link is clicked', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  let resumed = 0;
  const { setResume } = mountWelcome(root, { onPickMode: () => {}, onResume: () => resumed++ });
  setResume('Resume');
  root.querySelector('.welcome__resume').dispatch('click', {});
  assert.equal(resumed, 1);
});
