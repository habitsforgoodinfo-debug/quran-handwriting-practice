import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smartMatch } from '../../src/compare/smart-match.js';
import { parseVerse } from '../../src/verse/parser.js';
import { parseUserStream } from '../../src/compare/user-stream.js';

test('smartMatch: exact match → all ok', () => {
  const verses = [parseVerse('قُلْ')];
  const userItems = parseUserStream('قُلْ');
  const { annotations, completedVerses } = smartMatch(userItems, verses, { verseIdx: 0, wordIdx: 0 });
  const letterItems = annotations.filter(a => a.kind === 'letter');
  for (const a of letterItems) {
    assert.equal(a.letterStatus, 'ok', `letter ${a.user.letter}`);
    assert.notEqual(a.diaStatus, 'wrong', `diacritic on ${a.user.letter}`);
    assert.notEqual(a.diaStatus, 'missing', `diacritic on ${a.user.letter}`);
  }
  assert.deepEqual(completedVerses, [0]);
});

test('smartMatch: missing space between words is tolerated', () => {
  const verses = [parseVerse('قُلْ هُوَ')];
  const userItems = parseUserStream('قُلْهُوَ');
  const { annotations, completedVerses } = smartMatch(userItems, verses, { verseIdx: 0, wordIdx: 0 });
  for (const a of annotations.filter(a => a.kind === 'letter')) {
    assert.equal(a.letterStatus, 'ok');
  }
  assert.deepEqual(completedVerses, [0]);
});

test('smartMatch: silent expected letter user did not type is auto-skipped, not a mistake', () => {
  const verses = [parseVerse('قَالُوا')];
  const userItems = parseUserStream('قَالُو');
  const { annotations, completedVerses } = smartMatch(userItems, verses, { verseIdx: 0, wordIdx: 0 });
  for (const a of annotations.filter(a => a.kind === 'letter')) {
    assert.equal(a.letterStatus, 'ok', `letter ${a.user.letter}`);
  }
  assert.deepEqual(completedVerses, [0]);
});

test('smartMatch: wrong letter is flagged', () => {
  const verses = [parseVerse('قُلْ')];
  const userItems = parseUserStream('كُلْ');
  const { annotations } = smartMatch(userItems, verses, { verseIdx: 0, wordIdx: 0 });
  const letters = annotations.filter(a => a.kind === 'letter');
  assert.equal(letters[0].letterStatus, 'wrong');
  assert.equal(letters[1].letterStatus, 'ok');
});

test('smartMatch: wrong harakah is flagged', () => {
  const verses = [parseVerse('قُلْ')];
  const userItems = parseUserStream('قَلْ');
  const { annotations } = smartMatch(userItems, verses, { verseIdx: 0, wordIdx: 0 });
  const letters = annotations.filter(a => a.kind === 'letter');
  assert.equal(letters[0].letterStatus, 'ok');
  assert.equal(letters[0].diaStatus, 'wrong');
});

test('smartMatch: extra letters past expected go to extra', () => {
  const verses = [parseVerse('قُلْ')];
  const userItems = parseUserStream('قُلْك');
  const { annotations } = smartMatch(userItems, verses, { verseIdx: 0, wordIdx: 0 });
  const letters = annotations.filter(a => a.kind === 'letter');
  assert.equal(letters[0].letterStatus, 'ok');
  assert.equal(letters[1].letterStatus, 'ok');
  assert.equal(letters[2].letterStatus, 'extra');
});

test('parseUserStream: spaces are preserved as items', () => {
  const items = parseUserStream('بَ سَ');
  assert.equal(items.length, 3);
  assert.equal(items[1].kind, 'space');
});
