import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starsFor } from '../../src/stats/stars.js';

test('starsFor: incomplete surah earns 0 stars regardless of accuracy', () => {
  assert.equal(starsFor({ written: 6, total: 7, accuracyPct: 100 }), 0);
  assert.equal(starsFor({ written: 0, total: 7, accuracyPct: 100 }), 0);
});

test('starsFor: 3 stars at >= 95% when fully written', () => {
  assert.equal(starsFor({ written: 7, total: 7, accuracyPct: 95 }), 3);
  assert.equal(starsFor({ written: 7, total: 7, accuracyPct: 100 }), 3);
  assert.equal(starsFor({ written: 10, total: 7, accuracyPct: 96 }), 3);
});

test('starsFor: 2 stars in [85, 95)', () => {
  assert.equal(starsFor({ written: 7, total: 7, accuracyPct: 85 }), 2);
  assert.equal(starsFor({ written: 7, total: 7, accuracyPct: 94 }), 2);
});

test('starsFor: 1 star below 85% when fully written', () => {
  assert.equal(starsFor({ written: 7, total: 7, accuracyPct: 84 }), 1);
  assert.equal(starsFor({ written: 7, total: 7, accuracyPct: 0 }), 1);
});

test('starsFor: null/undefined accuracy treated as 0 (1 star if complete)', () => {
  assert.equal(starsFor({ written: 7, total: 7, accuracyPct: null }), 1);
  assert.equal(starsFor({ written: 7, total: 7 }), 1);
});

test('starsFor: zero/invalid total yields 0', () => {
  assert.equal(starsFor({ written: 0, total: 0, accuracyPct: 100 }), 0);
  assert.equal(starsFor({}), 0);
});
