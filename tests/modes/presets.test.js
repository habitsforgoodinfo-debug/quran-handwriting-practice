import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODE_PRESETS, resolveModeConfig } from '../../src/modes/presets.js';
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
