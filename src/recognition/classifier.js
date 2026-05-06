import { resample, normalize, dtwDistance } from './dtw.js';
import { buildAllTemplates } from './templates.js';

const SAMPLE_N = 64;
const UNCLEAR_DEFAULT = 0.25;

function clusterToShape(cluster) {
  const all = [];
  for (const s of cluster.strokes) all.push(...s.points.map(p => ({ x: p.x, y: p.y })));
  if (all.length < 2) return null;
  return normalize(resample(all, SAMPLE_N));
}

export function classifyClusters(clusters, expectedLetters, opts = {}) {
  const { unclearThreshold = UNCLEAR_DEFAULT, templates = null } = opts;
  const tplMap = templates || buildAllTemplates();
  const out = [];
  for (let i = 0; i < clusters.length; i++) {
    const shape = clusterToShape(clusters[i]);
    if (!shape) { out.push({ matchedLetter: null, confidence: 0, distance: Infinity, unclear: true }); continue; }

    const candidates = expectedLetters.length
      ? Array.from(new Set(expectedLetters))
      : Object.keys(tplMap);

    let best = null, bestDist = Infinity, second = Infinity;
    for (const letter of candidates) {
      const tpl = tplMap[letter];
      if (!tpl) continue;
      const d = dtwDistance(shape, tpl.points);
      if (d < bestDist) { second = bestDist; bestDist = d; best = letter; }
      else if (d < second) { second = d; }
    }

    const ABSOLUTE_GOOD = 0.05; // distance below this is a clearly good match regardless of confidence gap
    const confidence = second === Infinity ? 0 : Math.max(0, (second - bestDist) / Math.max(second, 1e-6));
    const positional = expectedLetters[i] ?? best;
    let matchedLetter = best;
    if (positional && positional !== best) {
      const tpl = tplMap[positional];
      if (tpl) {
        const dPos = dtwDistance(shape, tpl.points);
        if (dPos <= bestDist * 1.3) matchedLetter = positional;
      }
    }
    const unclear = bestDist > ABSOLUTE_GOOD && confidence < unclearThreshold;
    out.push({ matchedLetter, confidence, distance: bestDist, unclear });
  }
  return out;
}
