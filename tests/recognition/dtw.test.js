import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resample, normalize, dtwDistance } from '../../src/recognition/dtw.js';

test('resample produces exactly N points', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  const r = resample(pts, 32);
  assert.equal(r.length, 32);
});

test('resample handles empty and single-point input', () => {
  assert.deepEqual(resample([], 5), []);
  const single = resample([{ x: 1, y: 2 }], 4);
  assert.equal(single.length, 4);
  for (const p of single) {
    assert.equal(p.x, 1);
    assert.equal(p.y, 2);
  }
});

test('normalize centers centroid at origin', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const n = normalize(pts);
  const cx = n.reduce((s, p) => s + p.x, 0) / n.length;
  const cy = n.reduce((s, p) => s + p.y, 0) / n.length;
  assert.ok(Math.abs(cx) < 1e-9);
  assert.ok(Math.abs(cy) < 1e-9);
});

test('normalize scales so max absolute coordinate is 0.5', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  const n = normalize(pts);
  let maxAbs = 0;
  for (const p of n) {
    if (Math.abs(p.x) > maxAbs) maxAbs = Math.abs(p.x);
    if (Math.abs(p.y) > maxAbs) maxAbs = Math.abs(p.y);
  }
  assert.ok(Math.abs(maxAbs - 0.5) < 1e-9);
});

test('normalize handles empty and degenerate input', () => {
  assert.deepEqual(normalize([]), []);
  const deg = normalize([{ x: 5, y: 5 }, { x: 5, y: 5 }]);
  assert.equal(deg.length, 2);
  for (const p of deg) {
    assert.ok(Math.abs(p.x) < 1e-9);
    assert.ok(Math.abs(p.y) < 1e-9);
  }
});

test('dtwDistance(a, a) is approximately 0', () => {
  const a = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 3, y: 1 }];
  const d = dtwDistance(a, a);
  assert.ok(Math.abs(d) < 1e-9);
});

test('dtwDistance for different sequences > self distance', () => {
  const a = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
  const b = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }];
  const dSelf = dtwDistance(a, a);
  const dDiff = dtwDistance(a, b);
  assert.ok(dDiff > dSelf);
});
