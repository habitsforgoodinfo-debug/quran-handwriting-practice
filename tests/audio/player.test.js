import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAyahUrl, RECITERS } from '../../src/audio/player.js';

test('buildAyahUrl: zero-pads surah and ayah to 3 digits', () => {
  assert.equal(
    buildAyahUrl('Alafasy_64kbps', 1, 1),
    'https://everyayah.com/data/Alafasy_64kbps/001001.mp3'
  );
  assert.equal(
    buildAyahUrl('Husary_64kbps', 12, 5),
    'https://everyayah.com/data/Husary_64kbps/012005.mp3'
  );
});

test('buildAyahUrl: handles 3-digit surah/ayah without overflow', () => {
  assert.equal(
    buildAyahUrl('Alafasy_64kbps', 114, 6),
    'https://everyayah.com/data/Alafasy_64kbps/114006.mp3'
  );
  assert.equal(
    buildAyahUrl('Alafasy_64kbps', 2, 286),
    'https://everyayah.com/data/Alafasy_64kbps/002286.mp3'
  );
});

test('RECITERS: includes default Alafasy as first entry', () => {
  assert.ok(RECITERS.length >= 1);
  assert.equal(RECITERS[0].id, 'Alafasy_64kbps');
});
