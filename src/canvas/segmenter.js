function bbox(stroke) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

const area    = (b) => b.w * b.h;
const centerX = (b) => (b.minX + b.maxX) / 2;
const centerY = (b) => (b.minY + b.maxY) / 2;

function mergeBbox(a, b) {
  const minX = Math.min(a.minX, b.minX);
  const minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.maxX, b.maxX);
  const maxY = Math.max(a.maxY, b.maxY);
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function segment(strokes, canvas) {
  if (!strokes.length) return { clusters: [] };
  const tagged = strokes.map(s => ({ stroke: s, bbox: bbox(s) }));
  const canvasArea = canvas.width * canvas.height;

  const big   = tagged.filter(t => area(t.bbox) >= 0.04 * canvasArea);
  const small = tagged.filter(t => area(t.bbox) <  0.04 * canvasArea);

  const letterTagged = big.length ? big : tagged;
  const diacriticTagged = big.length ? small : [];

  const ys = letterTagged.map(t => centerY(t.bbox)).sort((a, b) => a - b);
  const baselineY = ys[Math.floor(ys.length / 2)];

  const sorted = [...letterTagged].sort((a, b) => centerX(b.bbox) - centerX(a.bbox));
  const clusters = [];
  const gapThresh = 0.04 * canvas.width;
  for (const t of sorted) {
    const last = clusters.at(-1);
    if (last && (last.bbox.minX - t.bbox.maxX) <= gapThresh) {
      last.strokes.push(t.stroke);
      last.bbox = mergeBbox(last.bbox, t.bbox);
    } else {
      clusters.push({ strokes: [t.stroke], bbox: { ...t.bbox }, diacritics: [] });
    }
  }

  for (const d of diacriticTagged) {
    const dx = centerX(d.bbox);
    let best = null, bestDist = Infinity;
    for (const c of clusters) {
      const dist = Math.abs(dx - centerX(c.bbox));
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    if (best) {
      const dy = centerY(d.bbox);
      let position = 'over';
      if (dy < best.bbox.minY) position = 'above';
      else if (dy > best.bbox.maxY) position = 'below';
      best.diacritics.push({ stroke: d.stroke, bbox: d.bbox, position });
    }
  }

  return { clusters, baselineY };
}
