export function align(expectedGlyphs, recognized) {
  const userExpected = expectedGlyphs.filter(g => !g.isSilent);
  const recLetters = recognized.letters || [];
  const recDiacritics = (recognized.diacritics || []).slice();

  const expectedDiacriticsInOrder = userExpected.map(g => g.diacritics[0] || null);

  const result = [];
  let recIdx = 0;
  let userPosCount = 0;

  for (const g of expectedGlyphs) {
    if (g.isSilent) {
      result.push({
        expected: g, letterMatch: 'autofill', diacriticMatch: 'n/a',
        actualLetter: null, actualDiacritics: []
      });
      continue;
    }
    const rec = recLetters[recIdx];
    const expectedDia = expectedDiacriticsInOrder[userPosCount];
    const actualDia = recDiacritics[userPosCount] ?? null;

    let letterMatch;
    if (!rec) letterMatch = 'missing';
    else if (rec.unclear) letterMatch = 'unclear';
    else letterMatch = rec.matchedLetter === g.letter ? 'ok' : 'wrong';

    let diacriticMatch;
    if (expectedDia == null) diacriticMatch = 'n/a';
    else if (actualDia == null) diacriticMatch = 'missing';
    else diacriticMatch = actualDia === expectedDia ? 'ok' : 'wrong';

    result.push({
      expected: g,
      letterMatch,
      diacriticMatch,
      actualLetter: rec?.matchedLetter ?? null,
      actualDiacritics: actualDia ? [actualDia] : []
    });

    if (rec) recIdx++;
    userPosCount++;
  }

  const extras = [];
  for (let i = recIdx; i < recLetters.length; i++) {
    extras.push({ kind: 'letter', value: recLetters[i].matchedLetter });
  }
  for (let i = userPosCount; i < recDiacritics.length; i++) {
    extras.push({ kind: 'diacritic', value: recDiacritics[i] });
  }
  return { result, extras };
}
