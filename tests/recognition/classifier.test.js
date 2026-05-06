import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyClusters } from '../../src/recognition/classifier.js';
import { resample, normalize } from '../../src/recognition/dtw.js';

const norm = (pts) => ({ points: normalize(resample(pts, 64)) });

// Build a tiny mock template map: each "letter" is a 2-point segment with distinct shape.
function mockTemplate(points) {
  // Normalize-like: just use the points as-is (the matching is comparative).
  return { points };
}
const mockTemplates = {
  'ك': mockTemplate([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]),
  'ت': mockTemplate([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]),
  'ل': mockTemplate([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])
};

const cluster = (pts) => ({ strokes: [{ points: pts.map(([x, y]) => ({ x, y })) }], diacritics: [] });

test('classifyClusters: returns one entry per cluster, in order', () => {
  const clusters = [cluster([[0, 0], [1, 0], [2, 0]]), cluster([[0, 0], [0, 1], [0, 2]])];
  const out = classifyClusters(clusters, ['ك', 'ت'], { templates: mockTemplates });
  assert.equal(out.length, 2);
  assert.ok(['ك', 'ت'].includes(out[0].matchedLetter));
  assert.ok(['ك', 'ت'].includes(out[1].matchedLetter));
});

test('classifyClusters: empty/degenerate cluster yields null match', () => {
  const c = { strokes: [{ points: [{ x: 0, y: 0 }] }], diacritics: [] };
  const out = classifyClusters([c], ['ك'], { templates: mockTemplates });
  assert.equal(out[0].matchedLetter, null);
  assert.equal(out[0].unclear, true);
});

test('classifyClusters: confidence field exists', () => {
  const out = classifyClusters([cluster([[0,0],[1,0],[2,0]])], ['ك'], { templates: mockTemplates });
  assert.ok('confidence' in out[0]);
});

test('classifyClusters: positional letter wins when both candidates are close', () => {
  // Two templates with very similar shapes — both close to the cluster.
  // Templates are pre-normalized to match the classifier's internal cluster shape.
  // Both templates slightly off the cluster, with B only ~1.2× farther than A — within the 1.3× window.
  const tplA = norm([{ x: 0, y: 0.01 }, { x: 1, y: 0 }, { x: 2, y: 0.01 }]);
  const tplB = norm([{ x: 0, y: 0.012 }, { x: 1, y: 0 }, { x: 2, y: 0.012 }]);
  const tplsClose = { 'A': tplA, 'B': tplB };
  // Cluster is straight horizontal → matches both very closely. Best by distance is A,
  // but positional[0] is 'B' and dPos within 1.3× of bestDist, so positional should win.
  const cluster = { strokes: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }], diacritics: [] };
  const out = classifyClusters([cluster], ['B', 'A'], { templates: tplsClose });
  assert.equal(out[0].matchedLetter, 'B');
});

test('classifyClusters: when positional is far from cluster, best-by-distance wins', () => {
  // A close horizontal template + a very different template.
  const tplA = norm([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]); // horizontal
  const tplB = norm([{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 0, y: 10 }]); // vertical, far
  const tpls = { 'A': tplA, 'B': tplB };
  const cluster = { strokes: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }], diacritics: [] };
  const out = classifyClusters([cluster], ['B', 'A'], { templates: tpls });
  // Positional says B but B's distance >> A's, ratio > 1.3 — best-by-distance (A) wins.
  assert.equal(out[0].matchedLetter, 'A');
});

test('classifyClusters: a near-perfect match is never flagged unclear', () => {
  const tplA = norm([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  const tplB = norm([{ x: 0, y: 0 }, { x: 1, y: 0.005 }, { x: 2, y: 0 }]);
  // With two near-identical templates, the confidence gap is tiny
  // — but bestDist is also tiny (below ABSOLUTE_GOOD), so unclear should be false.
  const cluster = { strokes: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }], diacritics: [] };
  const out = classifyClusters([cluster], [], { templates: { 'A': tplA, 'B': tplB } });
  assert.equal(out[0].unclear, false);
});
