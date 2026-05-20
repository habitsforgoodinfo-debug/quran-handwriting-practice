// Tactile + audio feedback hooks. All wrapped so unsupported browsers
// (especially iOS Safari which has no vibrate) silently no-op.

let audioCtx = null;
function ensureCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  } catch {}
  return audioCtx;
}

export function vibrateTap() {
  try { if (navigator.vibrate) navigator.vibrate(8); } catch {}
}

export function vibrateWrong() {
  try { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch {}
}

export function chimeComplete() {
  try { if (navigator.vibrate) navigator.vibrate([10, 20, 10, 20, 30]); } catch {}
  const ctx = ensureCtx();
  if (!ctx) return;
  // Two-note soft "ding-dong" using sine waves with quick envelope.
  const now = ctx.currentTime;
  const play = (freq, start, dur = 0.18) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.start(start);
    o.stop(start + dur + 0.02);
  };
  play(880, now);            // A5
  play(1175, now + 0.16);    // D6
}
