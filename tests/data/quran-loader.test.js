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

test('quran-loader: concurrent calls share one in-flight fetch', async () => {
  _resetForTests();
  let calls = 0;
  let resolveFetch;
  globalThis.fetch = () => {
    calls++;
    return new Promise(res => { resolveFetch = () => res({ ok: true, json: async () => ({ '1': { verses: { '1': 'x' } } }) }); });
  };
  const p1 = loadQuran();
  const p2 = loadQuran();
  // both should reuse the same single fetch
  resolveFetch();
  await Promise.all([p1, p2]);
  assert.equal(calls, 1, 'concurrent loadQuran calls should share one fetch');
});

test('quran-loader: failed fetch can be retried', async () => {
  _resetForTests();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error('network');
    return { ok: true, json: async () => ({ '1': { verses: { '1': 'x' } } }) };
  };
  await assert.rejects(loadQuran(), /network/);
  // Second call should re-fetch and succeed (proves inflight was cleared)
  await loadQuran();
  assert.equal(calls, 2);
});
