import { DEFAULT_REQUIRED_LETTERS } from '../store/settings.js';

export const MODE_PRESETS = {
  refresher: { requiredLetters: DEFAULT_REQUIRED_LETTERS, requiredHarakat: [], isDictation: false },
  thorough:  { requiredLetters: null,                     requiredHarakat: [], isDictation: false },
  dictation: { requiredLetters: null,                     requiredHarakat: [], isDictation: true  }
};

export function resolveModeConfig(mode, _settings) {
  const preset = MODE_PRESETS[mode];
  if (!preset) throw new Error(`Unknown mode: ${mode}`);
  return {
    ...preset,
    requiredLetters: preset.requiredLetters ? [...preset.requiredLetters] : null,
    requiredHarakat: [...preset.requiredHarakat],
  };
}

/**
 * Apply the requireMadd flag to a requiredHarakat value.
 *
 * Rules:
 *   - null means "all harakat required" - maddah_above is already implied,
 *     so leave it unchanged.
 *   - If requireMadd is false, return the base unchanged.
 *   - Otherwise append 'maddah_above' to a copy of the array if not already
 *     present.
 *
 * @param {string[]|null} requiredHarakat - base value (from mode or settings)
 * @param {boolean} requireMadd - whether to force maddah_above into the set
 * @returns {string[]|null}
 */
export function withMadd(requiredHarakat, requireMadd) {
  if (!requireMadd) return requiredHarakat;
  if (requiredHarakat === null) return null; // null = all required, already includes madd
  if (requiredHarakat.includes('maddah_above')) return requiredHarakat;
  return [...requiredHarakat, 'maddah_above'];
}
