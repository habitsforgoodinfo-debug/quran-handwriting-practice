import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDocument } from '../_helpers/dom-stub.js';
import { mountHeatmapStrip } from '../../src/ui/heatmap-strip.js';

test('heatmap-strip: renders one chip per worst item', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountHeatmapStrip(root);
  api.update([
    { kind: 'diacritic', value: 'shadda', count: 9 },
    { kind: 'letter',    value: 'ع',     count: 4 }
  ]);
  assert.equal(root.querySelectorAll('.heatmap-chip').length, 2);
});

test('heatmap-strip: shows fallback when empty', () => {
  globalThis.document = makeDocument();
  const root = document.createElement('div');
  const api = mountHeatmapStrip(root);
  api.update([]);
  assert.ok(root.textContent.includes('build a baseline'));
});
