import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCommitSwipe } from '../../src/canvas/gestures.js';

const CANVAS = { width: 300, height: 200 };
const stroke = (points) => ({ points: points.map((p, i) => ({ ...p, t: i * 50 })) });

test('isCommitSwipe: detects quick R→L swipe across most of canvas', () => {
  const s = stroke([{ x: 280, y: 100 }, { x: 200, y: 100 }, { x: 100, y: 100 }, { x: 30, y: 100 }]);
  assert.equal(isCommitSwipe(s, CANVAS), true);
});

test('isCommitSwipe: rejects L→R swipe', () => {
  const s = stroke([{ x: 30, y: 100 }, { x: 280, y: 100 }]);
  assert.equal(isCommitSwipe(s, CANVAS), false);
});

test('isCommitSwipe: rejects too-short stroke', () => {
  const s = stroke([{ x: 100, y: 100 }, { x: 80, y: 100 }]);
  assert.equal(isCommitSwipe(s, CANVAS), false);
});

test('isCommitSwipe: rejects stroke with too much vertical travel', () => {
  const s = stroke([{ x: 280, y: 20 }, { x: 30, y: 180 }]);
  assert.equal(isCommitSwipe(s, CANVAS), false);
});

test('isCommitSwipe: rejects slow stroke', () => {
  const pts = [{ x: 280, y: 100, t: 0 }, { x: 30, y: 100, t: 1500 }];
  assert.equal(isCommitSwipe({ points: pts }, CANVAS), false);
});

test('isCommitSwipe: rejects stroke with fewer than 3 points', () => {
  // even if dx & dy & dt look fine, < 3 points should fail
  const pts = [{ x: 280, y: 100, t: 0 }, { x: 30, y: 100, t: 100 }];
  assert.equal(isCommitSwipe({ points: pts }, CANVAS), false);
});
