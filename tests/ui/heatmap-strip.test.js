import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountHeatmapStrip } from '../../src/ui/heatmap-strip.js';

test('progress-strip: shows surah/ayah/word position', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountHeatmapStrip(root);
  api.update({ surahName: 'Al-Fatiha', ayah: 2, wordIdx: 1, totalWords: 4 });
  assert.ok(root.textContent.includes('Al-Fatiha'));
  assert.ok(root.textContent.includes('word 2 of 4'));
});

test('progress-strip: null payload clears', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountHeatmapStrip(root);
  api.update({ surahName: 'Test', ayah: 1, wordIdx: 0, totalWords: 1 });
  api.update(null);
  assert.equal(root.textContent.trim(), '');
});

test('progress-strip: legacy array input is treated as clear', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountHeatmapStrip(root);
  api.update({ surahName: 'Test', ayah: 1, wordIdx: 0, totalWords: 1 });
  api.update([{ kind: 'letter', value: 'ع', count: 5 }]);
  assert.equal(root.textContent.trim(), '');
});
