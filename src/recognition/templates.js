// DOM-dependent module: uses document.createElement('canvas') and canvas font rendering.
// No Node unit tests — Node has no document and no canvas font rendering.
// Tests inject mock templates directly into the classifier instead.

import { resample, normalize } from './dtw.js';

export const ARABIC_LETTERS = [
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر',
  'ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي','ء','ة',
  'ى','أ','إ','آ','ؤ','ئ'
];

const TEMPLATE_SIZE = 64;

function tracePixels(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const pts = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a > 64) { pts.push({ x, y }); break; }
    }
  }
  return pts;
}

export function buildLetterTemplate(letter, fontSpec = '120px "Noto Naskh Arabic", serif') {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, canvas.width / 2, canvas.height / 2);
  let pts = tracePixels(canvas);
  if (pts.length < 4) {
    pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 0 }];
  }
  const resampled = resample(pts, TEMPLATE_SIZE);
  const normed = normalize(resampled);
  return { letter, points: normed };
}

let cache = null;
export function buildAllTemplates(fontSpec) {
  if (cache) return cache;
  cache = {};
  for (const l of ARABIC_LETTERS) cache[l] = buildLetterTemplate(l, fontSpec);
  return cache;
}

export function _resetTemplatesForTests() { cache = null; }
