export function isCommitSwipe(stroke, canvas) {
  const pts = stroke.points;
  if (!pts || pts.length < 3) return false;
  const a = pts[0];
  const b = pts.at(-1);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dt = (b.t ?? 0) - (a.t ?? 0);
  if (dt > 600) return false;
  if (Math.abs(dx) < 0.6 * canvas.width) return false;
  if (dx >= 0) return false;
  if (Math.abs(dy) > 0.2 * canvas.height) return false;
  return true;
}
