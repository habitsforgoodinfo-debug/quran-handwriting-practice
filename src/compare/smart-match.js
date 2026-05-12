// Tolerant matching of a user-input stream against the remaining expected
// glyphs. Spaces in user input are ignored for matching purposes (kept for
// rendering). Silent expected letters the user did NOT type are auto-skipped.

export function smartMatch(userItems, parsedVerses, startCursor) {
  // Flatten expected glyphs from startCursor onward.
  const expectedStream = [];
  for (let vi = startCursor.verseIdx; vi < parsedVerses.length; vi++) {
    const verse = parsedVerses[vi];
    const wStart = (vi === startCursor.verseIdx) ? startCursor.wordIdx : 0;
    for (let wi = wStart; wi < verse.length; wi++) {
      const word = verse[wi];
      for (let gi = 0; gi < word.length; gi++) {
        expectedStream.push({ glyph: word[gi], verseIdx: vi, wordIdx: wi, glyphIdx: gi });
      }
    }
  }

  const annotations = [];
  let ei = 0;
  const verseAlignments = new Map();

  function recordAlignment(e, letterMatch, diacriticMatch, actualLetter, actualDiacritics) {
    if (!verseAlignments.has(e.verseIdx)) verseAlignments.set(e.verseIdx, new Map());
    const verseMap = verseAlignments.get(e.verseIdx);
    if (!verseMap.has(e.wordIdx)) verseMap.set(e.wordIdx, []);
    verseMap.get(e.wordIdx).push({
      expected: e.glyph,
      letterMatch,
      diacriticMatch,
      actualLetter,
      actualDiacritics
    });
  }

  for (const u of userItems) {
    if (u.kind === 'space') {
      annotations.push({ kind: 'space' });
      continue;
    }
    // Skip silent expected letters the user didn't type (no penalty).
    while (ei < expectedStream.length
           && expectedStream[ei].glyph.isSilent
           && expectedStream[ei].glyph.letter !== u.letter) {
      recordAlignment(expectedStream[ei], 'autofill', 'n/a', null, []);
      ei++;
    }
    if (ei >= expectedStream.length) {
      annotations.push({ kind: 'letter', letterStatus: 'extra', diaStatus: 'n/a', user: u });
      continue;
    }
    const e = expectedStream[ei];
    const letterOk = u.letter === e.glyph.letter;
    const expectedDias = new Set(e.glyph.diacritics);
    const userDias = new Set(u.diacritics);
    let diaStatus;
    if (expectedDias.size === 0 && userDias.size === 0) diaStatus = 'n/a';
    else if (setsEqual(expectedDias, userDias)) diaStatus = 'ok';
    else if (expectedDias.size > 0 && userDias.size === 0) diaStatus = 'missing';
    else diaStatus = 'wrong';

    annotations.push({
      kind: 'letter',
      letterStatus: letterOk ? 'ok' : 'wrong',
      diaStatus,
      user: u,
      expected: e.glyph
    });
    recordAlignment(e, letterOk ? 'ok' : 'wrong', diaStatus, u.letter, u.diacritics);
    ei++;
  }

  // After consuming all user input, also auto-skip trailing silent expected
  // letters (so a verse ending with a silent alif still counts as complete).
  while (ei < expectedStream.length && expectedStream[ei].glyph.isSilent) {
    recordAlignment(expectedStream[ei], 'autofill', 'n/a', null, []);
    ei++;
  }

  // Compute new cursor.
  let newCursor;
  if (ei >= expectedStream.length) {
    newCursor = { verseIdx: parsedVerses.length, wordIdx: 0 };
  } else {
    const next = expectedStream[ei];
    newCursor = { verseIdx: next.verseIdx, wordIdx: next.wordIdx };
  }

  // Verses fully consumed between startCursor and newCursor.
  const completedVerses = [];
  for (let vi = startCursor.verseIdx; vi < newCursor.verseIdx; vi++) {
    completedVerses.push(vi);
  }
  if (newCursor.verseIdx >= parsedVerses.length && startCursor.verseIdx < parsedVerses.length) {
    if (!completedVerses.includes(parsedVerses.length - 1)) {
      completedVerses.push(parsedVerses.length - 1);
    }
  }

  return { annotations, newCursor, completedVerses, verseAlignments };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}
