// Star rating for a completed surah. Single source of truth shared by the
// grid tiles and the completion celebration.
//
// Rules:
//   - A surah must be fully written (written >= total) to earn any stars.
//   - 3 stars at >= 95% accuracy, 2 at >= 85%, otherwise 1.
//
// `accuracyPct` is a 0..100 number (or null/undefined when no attempts were
// recorded - treated as 0).
export function starsFor({ written = 0, total = 0, accuracyPct = 0 } = {}) {
  if (total <= 0) return 0;
  if (written < total) return 0;
  const acc = Number.isFinite(accuracyPct) ? accuracyPct : 0;
  if (acc >= 95) return 3;
  if (acc >= 85) return 2;
  return 1;
}
