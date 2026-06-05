// Rapid fire is no longer a separate view. The button asks the app to
// jump to a verse the user has previously struggled with, plays its
// audio once, and lets the user write it in the normal practice
// canvas. Once written perfectly, markVerseComplete with perfect=true
// overwrites the prior record so the verse drops out of the pool.

import { getCompletedVerses } from '../store/stats.js';

// Returns the next rapid-fire challenge verse, or null if the pool is empty.
// Pool = previously-completed verses that were not perfect, or skipped.
export async function pickRapidFireChallenge() {
  const completed = await getCompletedVerses();
  const pool = completed.filter(v => !v.perfect || v.skipped);
  if (pool.length === 0) return null;
  // Oldest first - gives a sense of revisiting old mistakes.
  pool.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
  return pool[0];
}
