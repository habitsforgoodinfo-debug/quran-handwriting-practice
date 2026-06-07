import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortQueue, reviewLabel } from '../../src/review/queue.js';

test('sortQueue: ascending across surahs then ayahs', () => {
  const input = [
    { surah: 2, ayah: 5, rawText: 'b' },
    { surah: 1, ayah: 7, rawText: 'a' },
    { surah: 2, ayah: 1, rawText: 'c' },
    { surah: 1, ayah: 3, rawText: 'd' }
  ];
  const out = sortQueue(input);
  assert.deepEqual(
    out.map(v => `${v.surah}:${v.ayah}`),
    ['1:3', '1:7', '2:1', '2:5']
  );
});

test('sortQueue: does not mutate the input array', () => {
  const input = [{ surah: 2, ayah: 1 }, { surah: 1, ayah: 1 }];
  const copy = input.slice();
  sortQueue(input);
  assert.deepEqual(input, copy);
});

test('sortQueue: empty/undefined yields empty array', () => {
  assert.deepEqual(sortQueue([]), []);
  assert.deepEqual(sortQueue(undefined), []);
});

test('reviewLabel: full "Review 2 of 5 · Al-Fatiha · 3"', () => {
  assert.equal(
    reviewLabel({ attempted: 2, total: 5, surahName: 'Al-Fatiha', ayah: 3 }),
    'Review 2 of 5 · Al-Fatiha · 3'
  );
});

test('reviewLabel: omits tail when surah/ayah missing', () => {
  assert.equal(reviewLabel({ attempted: 1, total: 3 }), 'Review 1 of 3');
});
