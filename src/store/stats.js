import { counterIncrement, counterAll, counterClear } from './db.js';

export async function recordError({ kind, value }, deps = { counterIncrement, counterAll, counterClear }) {
  let store;
  if (kind === 'letter') store = 'letterErrors';
  else if (kind === 'diacritic') store = 'diacriticErrors';
  else throw new Error(`recordError: unknown kind "${kind}"`);
  await deps.counterIncrement(store, value);
}

export async function getStats(deps = { counterIncrement, counterAll, counterClear }) {
  const [letterErrors, diacriticErrors] = await Promise.all([
    deps.counterAll('letterErrors'),
    deps.counterAll('diacriticErrors')
  ]);
  return { letterErrors, diacriticErrors };
}

export async function resetStats(deps = { counterIncrement, counterAll, counterClear }) {
  await Promise.all([
    deps.counterClear('letterErrors'),
    deps.counterClear('diacriticErrors')
  ]);
}
