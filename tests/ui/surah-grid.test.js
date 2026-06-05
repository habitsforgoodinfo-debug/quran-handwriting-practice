import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountSurahGrid } from '../../src/ui/screens/surah-grid.js';

test('surah-grid: mounts 114 tiles', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  mountSurahGrid(root, { onPick: () => {}, onBack: () => {} });
  const tiles = root.querySelectorAll('.surah-tile');
  assert.equal(tiles.length, 114);
});

test('surah-grid: back button fires onBack', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  let backed = 0;
  mountSurahGrid(root, { onPick: () => {}, onBack: () => backed++ });
  root.querySelector('.surah-grid__back').dispatch('click', {});
  assert.equal(backed, 1);
});

test('surah-grid: tile with no progress fires onPick immediately', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const picks = [];
  mountSurahGrid(root, { onPick: (p) => picks.push(p), onBack: () => {} });
  // Tile 0 = surah 1, no progress = lastAyah defaults to 1.
  const tiles = root.querySelectorAll('.surah-tile');
  tiles[0].dispatch('click', { target: tiles[0] });
  assert.equal(picks.length, 1);
  assert.deepEqual(picks[0], { surah: 1, ayah: 1 });
});

test('surah-grid: tile with progress > 1 shows choice', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const picks = [];
  const { refreshStats } = mountSurahGrid(root, { onPick: (p) => picks.push(p), onBack: () => {} });
  refreshStats({ accMap: {}, progressBySurah: { 1: { written: 3, lastAyah: 4 } } });
  const tile = root.querySelectorAll('.surah-tile')[0];
  tile.dispatch('click', { target: tile });
  // Choice should now be present.
  const choice = tile.querySelector('.surah-tile__choice');
  assert.ok(choice, 'choice element should appear');
  assert.equal(picks.length, 0, 'onPick should not fire yet');
});

test('surah-grid: refreshStats marks low-accuracy tile', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const { refreshStats } = mountSurahGrid(root, { onPick: () => {}, onBack: () => {} });
  // 10 hits / 30 attempts = 33% - below 50% threshold.
  refreshStats({ accMap: { '1': { hits: 10, attempts: 30 } }, progressBySurah: {} });
  const tile = root.querySelectorAll('.surah-tile')[0];
  assert.ok(tile.classList.contains('surah-tile--low'));
});

test('surah-grid: refreshStats does not mark high-accuracy tile as low', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const { refreshStats } = mountSurahGrid(root, { onPick: () => {}, onBack: () => {} });
  refreshStats({ accMap: { '1': { hits: 28, attempts: 30 } }, progressBySurah: {} });
  const tile = root.querySelectorAll('.surah-tile')[0];
  assert.ok(!tile.classList.contains('surah-tile--low'));
});

test('surah-grid: refreshStats tolerates missing progress entries', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const { refreshStats } = mountSurahGrid(root, { onPick: () => {}, onBack: () => {} });
  // Should not throw even with completely empty maps.
  assert.doesNotThrow(() => refreshStats({}));
  assert.doesNotThrow(() => refreshStats({ accMap: undefined, progressBySurah: undefined }));
});
