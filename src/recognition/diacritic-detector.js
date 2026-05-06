function isLoop(stroke) {
  const pts = stroke.points;
  if (pts.length < 4) return false;
  const a = pts[0], b = pts.at(-1);
  return Math.hypot(a.x - b.x, a.y - b.y) < 6;
}

export function classifyDiacritic(diacritics) {
  if (!diacritics || diacritics.length === 0) return [];
  const above = diacritics.filter(d => d.position === 'above');
  const below = diacritics.filter(d => d.position === 'below');
  const over  = diacritics.filter(d => d.position === 'over');
  const out = [];
  if (above.length === 1) out.push(isLoop(above[0].stroke) ? 'damma' : 'fatha');
  else if (above.length >= 2) out.push('tanween_fath');
  if (below.length === 1) out.push('kasra');
  else if (below.length >= 2) out.push('tanween_kasr');
  if (over.length >= 1 && out.length === 0) out.push('sukun');
  return out;
}
