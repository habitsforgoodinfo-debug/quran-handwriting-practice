import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQuran, getVerse, _resetForTests } from '../../src/data/quran-loader.js';

test('quran-loader: fetches the bundled JSON once and serves verses', async () => {
  _resetForTests();
  const fakeData = { '1': { verses: { '1': 'بِسْمِ', '2': 'ٱلْحَمْدُ' } } };
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, json: async () => fakeData };
  };
  await loadQuran();
  assert.equal(getVerse(1, 1), 'بِسْمِ');
  assert.equal(getVerse(1, 2), 'ٱلْحَمْدُ');
  await loadQuran();
  assert.equal(calls, 1, 'fetch must only run once due to cache');
});

test('quran-loader: throws if verse is out of range', async () => {
  _resetForTests();
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ '1': { verses: { '1': 'x' } } }) });
  await loadQuran();
  assert.throws(() => getVerse(1, 99), /out of range/);
});
