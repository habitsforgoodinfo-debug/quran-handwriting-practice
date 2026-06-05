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
