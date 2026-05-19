import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from '../../src/store/settings.js';

function makeMockDb() {
  const map = new Map();
  return {
    map,
    kvGet: async (k) => map.get(k),
    kvPut: async (k, v) => { map.set(k, v); }
  };
}

test('settings: returns defaults when nothing is stored', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.deepEqual(s, DEFAULT_SETTINGS);
});

test('settings: persists updates and preserves untouched keys', async () => {
  const db = makeMockDb();
  await updateSettings({ reciter: 'Husary_64kbps' }, db);
  const s = await getSettings(db);
  assert.equal(s.reciter, 'Husary_64kbps');
  assert.equal(s.font, DEFAULT_SETTINGS.font);
});

test('settings: defaults include script="indopak"', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.equal(s.script, 'indopak');
});

test('settings: multiple updates merge correctly', async () => {
  const db = makeMockDb();
  await updateSettings({ reciter: 'A' }, db);
  await updateSettings({ strokeWidth: 7 }, db);
  const s = await getSettings(db);
  assert.equal(s.reciter, 'A');
  assert.equal(s.strokeWidth, 7);
});

test('settings: defaults include hintLevel="letter" and strict=false', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.equal(s.hintLevel, 'letter');
  assert.equal(s.strict, false);
});

test('settings: hintLevel can be updated and persists', async () => {
  const db = makeMockDb();
  await updateSettings({ hintLevel: 'full' }, db);
  const s = await getSettings(db);
  assert.equal(s.hintLevel, 'full');
});
