export function resample(points, n) {
  if (points.length === 0) return [];
  if (points.length === 1) return Array.from({ length: n }, () => ({ ...points[0] }));
  let total = 0;
  const segs = [];
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segs.push(d);
    total += d;
  }
  if (total === 0) return Array.from({ length: n }, () => ({ ...points[0] }));
  const step = total / (n - 1);
  const out = [{ ...points[0] }];
  let acc = 0, j = 1;
  for (let k = 1; k < n - 1; k++) {
    const target = step * k;
    while (j < points.length && acc + segs[j - 1] < target) {
      acc += segs[j - 1];
      j++;
    }
    if (j >= points.length) { out.push({ ...points.at(-1) }); continue; }
    const remain = target - acc;
    const frac = segs[j - 1] === 0 ? 0 : remain / segs[j - 1];
    out.push({
      x: points[j - 1].x + (points[j].x - points[j - 1].x) * frac,
      y: points[j - 1].y + (points[j].y - points[j - 1].y) * frac
    });
  }
  out.push({ ...points.at(-1) });
  return out;
}

export function normalize(points) {
  if (!points.length) return [];
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const centered = points.map(p => ({ x: p.x - cx, y: p.y - cy }));
  let maxAbs = 0;
  for (const p of centered) {
    if (Math.abs(p.x) > maxAbs) maxAbs = Math.abs(p.x);
    if (Math.abs(p.y) > maxAbs) maxAbs = Math.abs(p.y);
  }
  if (maxAbs === 0) return centered;
  const scale = 0.5 / maxAbs;
  return centered.map(p => ({ x: p.x * scale, y: p.y * scale }));
}

export function dtwDistance(seqA, seqB) {
  const n = seqA.length, m = seqB.length;
  const INF = Infinity;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(INF));
  dp[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const dx = seqA[i - 1].x - seqB[j - 1].x;
      const dy = seqA[i - 1].y - seqB[j - 1].y;
      const cost = Math.hypot(dx, dy);
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[n][m] / (n + m);
}
