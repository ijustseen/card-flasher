import type { Card, Group } from "@/types/domain";

export type WritingTone = "good" | "bad" | "missing";

export type WritingSegment = {
  char: string;
  tone: WritingTone;
};

export function getRandomNextIndex(currentIndex: number, total: number) {
  if (total <= 1) {
    return currentIndex;
  }

  let nextIndex = currentIndex;

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * total);
  }

  return nextIndex;
}

export function buildWritingSegments(expected: string, actual: string) {
  const expectedNormalized = expected.toLocaleLowerCase();
  const actualNormalized = actual.toLocaleLowerCase();
  const expectedLength = expected.length;
  const actualLength = actual.length;
  const matrix: number[][] = Array.from({ length: expectedLength + 1 }, () =>
    Array(actualLength + 1).fill(0),
  );

  for (
    let expectedIndex = 0;
    expectedIndex <= expectedLength;
    expectedIndex += 1
  ) {
    matrix[expectedIndex][0] = expectedIndex;
  }

  for (let actualIndex = 0; actualIndex <= actualLength; actualIndex += 1) {
    matrix[0][actualIndex] = actualIndex;
  }

  for (
    let expectedIndex = 1;
    expectedIndex <= expectedLength;
    expectedIndex += 1
  ) {
    for (let actualIndex = 1; actualIndex <= actualLength; actualIndex += 1) {
      const substitutionCost =
        expectedNormalized[expectedIndex - 1] ===
        actualNormalized[actualIndex - 1]
          ? 0
          : 1;

      matrix[expectedIndex][actualIndex] = Math.min(
        matrix[expectedIndex - 1][actualIndex] + 1,
        matrix[expectedIndex][actualIndex - 1] + 1,
        matrix[expectedIndex - 1][actualIndex - 1] + substitutionCost,
      );
    }
  }

  const segments: WritingSegment[] = [];

  let expectedIndex = expectedLength;
  let actualIndex = actualLength;

  while (expectedIndex > 0 || actualIndex > 0) {
    const expectedChar = expected[expectedIndex - 1];
    const actualChar = actual[actualIndex - 1];

    if (
      expectedIndex > 0 &&
      actualIndex > 0 &&
      matrix[expectedIndex][actualIndex] ===
        matrix[expectedIndex - 1][actualIndex - 1] +
          (expectedNormalized[expectedIndex - 1] ===
          actualNormalized[actualIndex - 1]
            ? 0
            : 1)
    ) {
      segments.push({
        char: actualChar,
        tone:
          expectedNormalized[expectedIndex - 1] ===
          actualNormalized[actualIndex - 1]
            ? "good"
            : "bad",
      });
      expectedIndex -= 1;
      actualIndex -= 1;
      continue;
    }

    if (
      actualIndex > 0 &&
      matrix[expectedIndex][actualIndex] ===
        matrix[expectedIndex][actualIndex - 1] + 1
    ) {
      segments.push({ char: actualChar, tone: "bad" });
      actualIndex -= 1;
      continue;
    }

    if (expectedIndex > 0) {
      segments.push({ char: expectedChar, tone: "missing" });
      expectedIndex -= 1;
    }
  }

  return segments.reverse();
}

export function getWritingToneClass(tone: WritingTone) {
  if (tone === "good") {
    return "text-emerald-600";
  }

  if (tone === "missing") {
    return "bg-yellow-100 text-yellow-700";
  }

  return "text-red-600";
}

export function filterCardsByStudyGroup(
  cards: Card[],
  studyGroupFilter: string,
) {
  return cards.filter((card) => {
    if (studyGroupFilter === "allGroups") {
      return true;
    }

    if (studyGroupFilter === "unsorted") {
      return card.groupIds.length === 0;
    }

    const groupId = Number(studyGroupFilter);
    return Number.isInteger(groupId) && card.groupIds.includes(groupId);
  });
}

export function filterCardsByListQuery(cards: Card[], listQuery: string) {
  const normalizedQuery = listQuery.trim().toLocaleLowerCase();

  if (normalizedQuery.length === 0) {
    return cards;
  }

  return cards.filter((card) => {
    const phrase = card.phrase.toLocaleLowerCase();
    const translation = card.translation.toLocaleLowerCase();

    return (
      phrase.includes(normalizedQuery) || translation.includes(normalizedQuery)
    );
  });
}

export function splitFilteredCards(filteredCards: Card[], groups: Group[]) {
  const unsortedFilteredCards = filteredCards.filter(
    (card) => card.groupIds.length === 0,
  );
  const groupedFilteredCards = groups
    .map((group) => ({
      group,
      cards: filteredCards.filter((card) => card.groupIds.includes(group.id)),
    }))
    .filter((item) => item.cards.length > 0);

  return { unsortedFilteredCards, groupedFilteredCards };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getWordFormPattern(word: string) {
  const lowerWord = word.toLocaleLowerCase();
  const escapedWord = escapeRegex(lowerWord);

  if (lowerWord.endsWith("y") && lowerWord.length > 2) {
    const stem = escapeRegex(lowerWord.slice(0, -1));
    return `(?:${escapedWord}|${stem}ies|${escapedWord}s|${escapedWord}ed|${escapedWord}ing)`;
  }

  if (lowerWord.endsWith("e") && lowerWord.length > 2) {
    const stem = escapeRegex(lowerWord.slice(0, -1));
    return `(?:${escapedWord}|${escapedWord}s|${stem}ed|${stem}ing)`;
  }

  return `${escapedWord}(?:s|es|ed|ing)?`;
}

export function maskPhraseInExample(example: string, phrase: string) {
  const normalizedPhrase = phrase.trim();

  if (!normalizedPhrase) {
    return example;
  }

  let masked = example.replace(
    new RegExp(escapeRegex(normalizedPhrase), "gi"),
    "______",
  );

  const words = Array.from(
    new Set(
      normalizedPhrase
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}']+/gu)
        ?.filter((word) => word.length > 1) ?? [],
    ),
  );

  for (const word of words) {
    const pattern = new RegExp(`\\b${getWordFormPattern(word)}\\b`, "giu");
    masked = masked.replace(pattern, "______");
  }

  return masked;
}
