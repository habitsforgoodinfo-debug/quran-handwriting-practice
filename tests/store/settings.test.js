import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSettings, updateSettings, DEFAULT_SETTINGS, ALL_HARAKAT } from '../../src/store/settings.js';

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

test('settings: defaults include strict=false', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.equal(s.strict, false);
});

test('settings: hintPolicy can be updated and persists', async () => {
  const db = makeMockDb();
  await updateSettings({ hintPolicy: 'always' }, db);
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'always');
});

test('settings: defaults include hintPolicy="auto"', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'auto');
  assert.equal(s.hintLevel, undefined);
});

test('settings: legacy hintLevel="none" migrates to hintPolicy="none"', async () => {
  const db = makeMockDb();
  db.map.set('settings', { hintLevel: 'none' });
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'none');
  assert.equal(s.hintLevel, undefined);
});

test('settings: legacy hintLevel="letter" migrates to hintPolicy="auto"', async () => {
  const db = makeMockDb();
  db.map.set('settings', { hintLevel: 'letter' });
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'auto');
});

test('settings: legacy hintLevel="full" migrates to hintPolicy="auto"', async () => {
  const db = makeMockDb();
  db.map.set('settings', { hintLevel: 'full' });
  const s = await getSettings(db);
  assert.equal(s.hintPolicy, 'auto');
});

test('settings: default requiredHarakat is [] (auto-fill on)', async () => {
  const db = makeMockDb();
  const s = await getSettings(db);
  assert.deepEqual(s.requiredHarakat, []);
});

test('settings: legacy ALL_HARAKAT stored default migrates to [] (auto-fill on)', async () => {
  const db = makeMockDb();
  // Simulate a user whose settings were saved with the old default (ALL_HARAKAT).
  db.map.set('settings', { requiredHarakat: [...ALL_HARAKAT] });
  const s = await getSettings(db);
  assert.deepEqual(s.requiredHarakat, []);
});

test('settings: partial harakat selection is preserved and not migrated', async () => {
  const db = makeMockDb();
  // A user who deliberately chose only fatha and kasra - must not be wiped.
  db.map.set('settings', { requiredHarakat: ['fatha', 'kasra'] });
  const s = await getSettings(db);
  assert.deepEqual(s.requiredHarakat, ['fatha', 'kasra']);
});
