import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDiacritic } from '../../src/recognition/diacritic-detector.js';

const shortStroke = { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }] };
const loopStroke = {
  points: [
    { x: 10, y: 10 }, { x: 14, y: 10 }, { x: 14, y: 14 },
    { x: 10, y: 14 }, { x: 10, y: 11 }
  ]
};

test('above + 1 short stroke → fatha', () => {
  const out = classifyDiacritic([{ position: 'above', stroke: shortStroke }]);
  assert.deepEqual(out, ['fatha']);
});

test('below + 1 stroke → kasra', () => {
  const out = classifyDiacritic([{ position: 'below', stroke: shortStroke }]);
  assert.deepEqual(out, ['kasra']);
});

test('over + closed loop → sukun', () => {
  const out = classifyDiacritic([{ position: 'over', stroke: loopStroke }]);
  assert.deepEqual(out, ['sukun']);
});

test('empty diacritics → []', () => {
  assert.deepEqual(classifyDiacritic([]), []);
  assert.deepEqual(classifyDiacritic(null), []);
});

test('above + 2 strokes → tanween_fath', () => {
  const out = classifyDiacritic([
    { position: 'above', stroke: shortStroke },
    { position: 'above', stroke: shortStroke }
  ]);
  assert.deepEqual(out, ['tanween_fath']);
});

test('above + 1 loop stroke → damma', () => {
  const out = classifyDiacritic([{ position: 'above', stroke: loopStroke }]);
  assert.deepEqual(out, ['damma']);
});

test('below + 2 strokes → tanween_kasr', () => {
  const out = classifyDiacritic([
    { position: 'below', stroke: shortStroke },
    { position: 'below', stroke: shortStroke }
  ]);
  assert.deepEqual(out, ['tanween_kasr']);
});
