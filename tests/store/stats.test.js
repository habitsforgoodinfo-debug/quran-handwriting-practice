import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordError, getStats, resetStats, getWorst } from '../../src/store/stats.js';

function makeMockDb() {
  const stores = { letterErrors: new Map(), diacriticErrors: new Map() };
  return {
    stores,
    counterIncrement: async (storeName, key) => {
      const m = stores[storeName];
      m.set(key, (m.get(key) || 0) + 1);
    },
    counterAll: async (storeName) => {
      const out = {};
      for (const [k, v] of stores[storeName]) out[k] = v;
      return out;
    },
    counterClear: async (storeName) => { stores[storeName].clear(); }
  };
}

test('stats: starts empty', async () => {
  const db = makeMockDb();
  const s = await getStats(db);
  assert.deepEqual(s.letterErrors, {});
  assert.deepEqual(s.diacriticErrors, {});
});

test('stats: records and counts letter + diacritic errors', async () => {
  const db = makeMockDb();
  await recordError({ kind: 'letter', value: 'ع' }, db);
  await recordError({ kind: 'letter', value: 'ع' }, db);
  await recordError({ kind: 'diacritic', value: 'kasra' }, db);
  const s = await getStats(db);
  assert.equal(s.letterErrors['ع'], 2);
  assert.equal(s.diacriticErrors['kasra'], 1);
});

test('stats: reset clears everything', async () => {
  const db = makeMockDb();
  await recordError({ kind: 'letter', value: 'ع' }, db);
  await resetStats(db);
  const s = await getStats(db);
  assert.deepEqual(s.letterErrors, {});
});

test('stats: recordError throws on unknown kind', async () => {
  const db = makeMockDb();
  await assert.rejects(
    () => recordError({ kind: 'letters', value: 'ع' }, db),
    /unknown kind/
  );
});

test('getWorst: returns top-n letter and diacritic errors by count', async () => {
  const deps = {
    counterAll: async (store) =>
      store === 'letterErrors'
        ? { 'ع': 5, 'ت': 2, 'ج': 9 }
        : { 'shadda': 7, 'fatha': 1 }
  };
  const worst = await getWorst(3, deps);
  assert.equal(worst.length, 3);
  assert.deepEqual(worst[0], { kind: 'letter', value: 'ج', count: 9 });
  assert.deepEqual(worst[1], { kind: 'diacritic', value: 'shadda', count: 7 });
  assert.deepEqual(worst[2], { kind: 'letter', value: 'ع', count: 5 });
});

test('getWorst: returns empty array when no errors recorded', async () => {
  const deps = { counterAll: async () => ({}) };
  const worst = await getWorst(3, deps);
  assert.deepEqual(worst, []);
});
