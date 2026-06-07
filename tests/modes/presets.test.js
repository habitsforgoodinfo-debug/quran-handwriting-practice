import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE_PRESETS, resolveModeConfig, withMadd } from '../../src/modes/presets.js';
import { DEFAULT_REQUIRED_LETTERS } from '../../src/store/settings.js';

test('presets: refresher uses DEFAULT_REQUIRED_LETTERS, no harakat, not dictation', () => {
  const cfg = resolveModeConfig('refresher', {});
  assert.deepEqual(cfg.requiredLetters, DEFAULT_REQUIRED_LETTERS);
  assert.deepEqual(cfg.requiredHarakat, []);
  assert.equal(cfg.isDictation, false);
});

test('presets: thorough uses null letters, no harakat, not dictation', () => {
  const cfg = resolveModeConfig('thorough', {});
  assert.equal(cfg.requiredLetters, null);
  assert.deepEqual(cfg.requiredHarakat, []);
  assert.equal(cfg.isDictation, false);
});

test('presets: dictation uses null letters, no harakat, isDictation=true', () => {
  const cfg = resolveModeConfig('dictation', {});
  assert.equal(cfg.requiredLetters, null);
  assert.deepEqual(cfg.requiredHarakat, []);
  assert.equal(cfg.isDictation, true);
});

test('presets: unknown mode throws', () => {
  assert.throws(() => resolveModeConfig('unknown', {}), /Unknown mode/);
});

test('presets: MODE_PRESETS has exactly the three expected keys', () => {
  assert.deepEqual(Object.keys(MODE_PRESETS).sort(), ['dictation', 'refresher', 'thorough']);
});

test('presets: resolveModeConfig returns a copy, not the preset reference', () => {
  const cfg = resolveModeConfig('thorough', {});
  cfg.isDictation = true;
  assert.equal(MODE_PRESETS.thorough.isDictation, false);
});

test('presets: mutating returned requiredLetters does not affect preset or next call', () => {
  const cfg1 = resolveModeConfig('refresher', {});
  cfg1.requiredLetters.push('X');
  assert.notDeepEqual(MODE_PRESETS.refresher.requiredLetters, cfg1.requiredLetters,
    'preset.requiredLetters should be unaffected by mutation of returned array');
  const cfg2 = resolveModeConfig('refresher', {});
  assert.deepEqual(cfg2.requiredLetters, DEFAULT_REQUIRED_LETTERS,
    'second resolveModeConfig call should return original requiredLetters');
});

test('presets: mutating returned requiredHarakat does not affect preset or next call', () => {
  const cfg1 = resolveModeConfig('refresher', {});
  cfg1.requiredHarakat.push('X');
  assert.deepEqual(MODE_PRESETS.refresher.requiredHarakat, [],
    'preset.requiredHarakat should be unaffected by mutation of returned array');
  const cfg2 = resolveModeConfig('refresher', {});
  assert.deepEqual(cfg2.requiredHarakat, [],
    'second resolveModeConfig call should return original requiredHarakat');
});

// --- withMadd helper ---

test('withMadd: null stays null (all-required mode, madd is already required)', () => {
  assert.equal(withMadd(null, true), null);
});

test('withMadd: false flag is a no-op regardless of base value', () => {
  assert.equal(withMadd(null, false), null);
  assert.deepEqual(withMadd([], false), []);
  assert.deepEqual(withMadd(['fatha'], false), ['fatha']);
});

test('withMadd: empty array + true adds maddah_above', () => {
  assert.deepEqual(withMadd([], true), ['maddah_above']);
});

test('withMadd: existing list + true appends maddah_above', () => {
  const result = withMadd(['fatha', 'kasra'], true);
  assert.deepEqual(result, ['fatha', 'kasra', 'maddah_above']);
});

test('withMadd: maddah_above already present - no duplicate added', () => {
  const result = withMadd(['maddah_above', 'fatha'], true);
  assert.deepEqual(result, ['maddah_above', 'fatha']);
});

test('withMadd: does not mutate the input array', () => {
  const base = ['fatha'];
  withMadd(base, true);
  assert.deepEqual(base, ['fatha']);
});
