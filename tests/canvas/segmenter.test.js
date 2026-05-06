import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segment } from '../../src/canvas/segmenter.js';

const CANVAS = { width: 300, height: 200 };
const makeStroke = (pts) => ({ points: pts.map(([x, y]) => ({ x, y, t: 0 })) });

test('segmenter: groups two well-separated stroke groups into two RTL clusters', () => {
  const left  = makeStroke([[20, 100], [40, 110], [60, 100]]);
  const right = makeStroke([[200, 100], [220, 110], [240, 100]]);
  const out = segment([left, right], CANVAS);
  assert.equal(out.clusters.length, 2);
  // RTL: rightmost cluster comes first
  assert.ok(out.clusters[0].bbox.minX > out.clusters[1].bbox.minX);
});

test('segmenter: classifies a small isolated stroke above the baseline as a diacritic', () => {
  const letter = makeStroke([[100, 130], [120, 140], [140, 130]]);
  const dot    = makeStroke([[110, 60], [114, 62]]);
  const out = segment([letter, dot], CANVAS);
  assert.equal(out.clusters.length, 1);
  assert.equal(out.clusters[0].diacritics.length, 1);
  assert.equal(out.clusters[0].diacritics[0].position, 'above');
});

test('segmenter: attaches a below-baseline mark to the nearest cluster', () => {
  const letter = makeStroke([[100, 100], [120, 110], [140, 100]]);
  const mark   = makeStroke([[115, 170], [120, 172]]);
  const out = segment([letter, mark], CANVAS);
  assert.equal(out.clusters[0].diacritics[0].position, 'below');
});

test('segmenter: empty input returns empty clusters array', () => {
  const out = segment([], CANVAS);
  assert.deepEqual(out.clusters, []);
});

test('segmenter: a small stroke much smaller than the median is a diacritic', () => {
  // Two large letter strokes + one tiny mark
  const lA = makeStroke([[10, 100], [40, 110], [70, 100], [100, 110]]); // ~90×10 = 900
  const lB = makeStroke([[150, 100], [180, 110], [210, 100], [240, 110]]); // ~90×10 = 900
  const dot = makeStroke([[180, 50], [185, 52]]); // ~5×2 = 10
  const out = segment([lA, lB, dot], CANVAS);
  assert.equal(out.clusters.length, 2);
  // dot attaches to one cluster (whichever is closer in x)
  const total = out.clusters.reduce((s, c) => s + c.diacritics.length, 0);
  assert.equal(total, 1);
});
