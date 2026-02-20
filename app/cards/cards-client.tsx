"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Hand,
  List,
  LogOut,
  PenLine,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import AppToast from "@/components/app-toast";

type Card = {
  id: number;
  phrase: string;
  translation: string;
  description_en: string;
  examples_en: string[];
  groupIds: number[];
};

type Group = {
  id: number;
  name: string;
  cardCount: number;
};

type Props = {
  userEmail: string;
  initialTargetLanguage: string;
};

type Mode = "random" | "writing" | "list";

export default function CardsClient({
  userEmail,
  initialTargetLanguage,
}: Props) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studyGroupFilter, setStudyGroupFilter] = useState("allGroups");
  const [mode, setMode] = useState<Mode>("random");
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [bulkNewGroupName, setBulkNewGroupName] = useState("");
  const [isCreatingBulkGroup, setIsCreatingBulkGroup] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [writingIndex, setWritingIndex] = useState(0);
  const [writingInput, setWritingInput] = useState("");
  const [writingChecked, setWritingChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [regeneratingCardId, setRegeneratingCardId] = useState<number | null>(
    null,
  );
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<number | null>(
    null,
  );
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writingInputRef = useRef<HTMLInputElement | null>(null);

  async function readJsonSafe<T>(response: Response, fallback: T): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      return fallback;
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [cardsResponse, groupsResponse] = await Promise.all([
          fetch("/api/cards", { cache: "no-store" }),
          fetch("/api/groups", { cache: "no-store" }),
        ]);

        const cardsResult = await readJsonSafe<{
          error?: string;
          cards?: Card[];
        }>(cardsResponse, {});

        const groupsResult = await readJsonSafe<{
          error?: string;
          groups?: Group[];
        }>(groupsResponse, {});

        if (cardsResponse.status === 401 || groupsResponse.status === 401) {
          router.push("/login");
          router.refresh();
          return;
        }

        if (!cardsResponse.ok) {
          throw new Error(cardsResult.error ?? "Failed to load cards.");
        }

        if (!groupsResponse.ok) {
          throw new Error(groupsResult.error ?? "Failed to load groups.");
        }

        const nextCards = cardsResult.cards ?? [];
        const nextGroups = groupsResult.groups ?? [];
        setCards(nextCards);
        setGroups(nextGroups);

        if (nextCards.length > 0) {
          const randomStartIndex = Math.floor(Math.random() * nextCards.length);
          setSelectedCardId((current) => current ?? nextCards[0].id);
          setIndex(randomStartIndex);
          setWritingIndex(randomStartIndex);
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Unknown error.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setConfirmDeleteCardId(null);
  }, [selectedCardId]);

  const studyCards = cards.filter((card) => {
    if (studyGroupFilter === "allGroups") {
      return true;
    }

    if (studyGroupFilter === "unsorted") {
      return card.groupIds.length === 0;
    }

    const groupId = Number(studyGroupFilter);
    return Number.isInteger(groupId) && card.groupIds.includes(groupId);
  });

  const activeCard =
    studyCards.length > 0 ? studyCards[index % studyCards.length] : null;
  const normalizedListQuery = listQuery.trim().toLocaleLowerCase();
  const filteredCards =
    normalizedListQuery.length === 0
      ? cards
      : cards.filter((card) => {
          const phrase = card.phrase.toLocaleLowerCase();
          const translation = card.translation.toLocaleLowerCase();
          return (
            phrase.includes(normalizedListQuery) ||
            translation.includes(normalizedListQuery)
          );
        });
  const unsortedFilteredCards = filteredCards.filter(
    (card) => card.groupIds.length === 0,
  );
  const groupedFilteredCards = groups
    .map((group) => ({
      group,
      cards: filteredCards.filter((card) => card.groupIds.includes(group.id)),
    }))
    .filter((item) => item.cards.length > 0);
  const selectedCard =
    filteredCards.find((card) => card.id === selectedCardId) ??
    filteredCards[0] ??
    null;
  const writingCard =
    studyCards.length > 0 ? studyCards[writingIndex % studyCards.length] : null;

  const normalizedWritingInput = writingInput.trim().toLocaleLowerCase();
  const normalizedWritingPhrase = writingCard?.phrase
    .trim()
    .toLocaleLowerCase();
  const isWritingCorrect =
    writingCard !== null && normalizedWritingInput === normalizedWritingPhrase;

  function getRandomNextIndex(currentIndex: number, total: number) {
    if (total <= 1) {
      return currentIndex;
    }

    let nextIndex = currentIndex;

    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * total);
    }

    return nextIndex;
  }

  function buildWritingSegments(expected: string, actual: string) {
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

    const segments: Array<{ char: string; tone: "good" | "bad" | "missing" }> =
      [];

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

  function getWritingToneClass(tone: "good" | "bad" | "missing") {
    if (tone === "good") {
      return "text-emerald-600";
    }

    if (tone === "missing") {
      return "bg-yellow-100 text-yellow-700";
    }

    return "text-red-600";
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function regenerateExamples(cardId: number) {
    try {
      setRegeneratingCardId(cardId);
      setError(null);

      const response = await fetch(`/api/cards/${cardId}/examples`, {
        method: "POST",
      });

      const result = await readJsonSafe<{
        error?: string;
        examplesEn?: string[];
      }>(response, {});

      if (response.status === 401) {
        router.push("/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to regenerate examples.");
      }

      const nextExamples = result.examplesEn ?? [];

      setCards((current) =>
        current.map((card) =>
          card.id === cardId ? { ...card, examples_en: nextExamples } : card,
        ),
      );

      setSuccessMessage("Examples updated.");

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 2500);
    } catch (regenerateError) {
      const message =
        regenerateError instanceof Error
          ? regenerateError.message
          : "Unknown error.";
      setError(message);
    } finally {
      setRegeneratingCardId(null);
    }
  }

  async function deleteCard(cardId: number) {
    try {
      setConfirmDeleteCardId(null);
      setDeletingCardId(cardId);
      setError(null);

      const response = await fetch(`/api/cards/${cardId}`, {
        method: "DELETE",
      });

      const result = await readJsonSafe<{ error?: string }>(response, {});

      if (response.status === 401) {
        router.push("/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to delete card.");
      }

      setCards((current) => {
        const nextCards = current.filter((card) => card.id !== cardId);
        setSelectedCardId(nextCards[0]?.id ?? null);
        setIndex(0);
        setWritingIndex(0);
        return nextCards;
      });

      setSuccessMessage("Card deleted.");

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 2500);
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unknown error.";
      setError(message);
    } finally {
      setDeletingCardId(null);
    }
  }

  async function refreshLocalCardsAndGroups() {
    const [cardsResponse, groupsResponse] = await Promise.all([
      fetch("/api/cards", { cache: "no-store" }),
      fetch("/api/groups", { cache: "no-store" }),
    ]);

    if (cardsResponse.ok) {
      const cardsResult = await readJsonSafe<{ cards?: Card[] }>(
        cardsResponse,
        {},
      );
      setCards(cardsResult.cards ?? []);
    }

    if (groupsResponse.ok) {
      const groupsResult = await readJsonSafe<{ groups?: Group[] }>(
        groupsResponse,
        {},
      );
      setGroups(groupsResult.groups ?? []);
    }
  }

  function toggleCardSelection(cardId: number) {
    setSelectedCardIds((current) =>
      current.includes(cardId)
        ? current.filter((item) => item !== cardId)
        : [...current, cardId],
    );
  }

  async function runBulkAction(
    action: "delete" | "moveToGroup" | "removeFromGroup" | "regenerate",
  ) {
    if (selectedCardIds.length === 0) {
      setError("Select at least one card.");
      return;
    }

    const parsedGroupId = Number(bulkGroupId);

    if (
      (action === "moveToGroup" || action === "removeFromGroup") &&
      (!Number.isInteger(parsedGroupId) || parsedGroupId <= 0)
    ) {
      setError("Choose a target group.");
      return;
    }

    try {
      setError(null);

      const payload: Record<string, unknown> = {
        action,
        cardIds: selectedCardIds,
      };

      if (action === "moveToGroup" || action === "removeFromGroup") {
        payload.groupId = parsedGroupId;
      }

      if (action === "regenerate") {
        payload.targetLanguage = initialTargetLanguage;
      }

      const response = await fetch("/api/cards/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await readJsonSafe<{ error?: string }>(response, {});

      if (response.status === 401) {
        router.push("/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Bulk action failed.");
      }

      setSuccessMessage("Bulk action completed.");
      setSelectedCardIds([]);
      setIsSelectMode(false);
      setBulkGroupId("");

      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 2500);

      await refreshLocalCardsAndGroups();
      router.refresh();
    } catch (bulkError) {
      const message =
        bulkError instanceof Error ? bulkError.message : "Unknown error.";
      setError(message);
    }
  }

  async function createBulkGroupInline() {
    const name = bulkNewGroupName.trim();

    if (!name) {
      setError("Group name is required.");
      return;
    }

    try {
      setIsCreatingBulkGroup(true);
      setError(null);

      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const result = await readJsonSafe<{ error?: string; group?: Group }>(
        response,
        {},
      );

      if (response.status === 401) {
        router.push("/login");
        router.refresh();
        return;
      }

      if (!response.ok || !result.group) {
        throw new Error(result.error ?? "Failed to create group.");
      }

      setGroups((current) => {
        const next = current.some((group) => group.id === result.group!.id)
          ? current
          : [...current, result.group!];
        return [...next].sort((a, b) => a.name.localeCompare(b.name));
      });
      setBulkGroupId(String(result.group.id));
      setBulkNewGroupName("");
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : "Unknown error.";
      setError(message);
    } finally {
      setIsCreatingBulkGroup(false);
    }
  }

  const goToNextWritingCard = useCallback(() => {
    setWritingIndex((value) => getRandomNextIndex(value, studyCards.length));
    setWritingInput("");
    setWritingChecked(false);
  }, [studyCards.length]);

  useEffect(() => {
    if (mode !== "writing") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();

      if (writingChecked) {
        goToNextWritingCard();
      } else {
        setWritingChecked(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mode, writingChecked, goToNextWritingCard]);

  useEffect(() => {
    if (mode !== "writing" || writingChecked) {
      return;
    }

    writingInputRef.current?.focus();
  }, [mode, writingChecked, writingCard?.id]);

  useEffect(() => {
    setIndex(0);
    setWritingIndex(0);
    setWritingInput("");
    setWritingChecked(false);
  }, [studyGroupFilter]);

  function renderCardDetails(card: Card, options?: { showPhrase?: boolean }) {
    const showPhrase = options?.showPhrase ?? true;

    return (
      <div className="space-y-3">
        {showPhrase ? (
          <h2 className="text-2xl font-semibold break-words md:text-3xl">
            {card.phrase}
          </h2>
        ) : null}

        <p className="text-sm">
          <span className="font-semibold">Translation:</span> {card.translation}
        </p>

        <p className="text-sm">
          <span className="font-semibold">Description:</span>{" "}
          {card.description_en}
        </p>

        <div className="text-sm">
          <p className="font-semibold">Examples:</p>
          {card.examples_en.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {card.examples_en.map((example, exampleIndex) => (
                <li key={`${card.id}-example-${exampleIndex}`}>{example}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-zinc-500 dark:text-zinc-400">
              No examples available yet.
            </p>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void regenerateExamples(card.id);
            }}
            disabled={regeneratingCardId === card.id}
            className="mt-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {regeneratingCardId === card.id
              ? "Generating..."
              : "Regenerate examples"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-zinc-100 p-4 text-zinc-900 dark:from-zinc-950 dark:to-zinc-950 dark:text-zinc-100 md:h-screen md:overflow-hidden md:p-8">
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 md:h-full md:overflow-hidden">
        <header className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                <BookOpen size={22} />
                Card Flasher
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {userEmail} · Target: {initialTargetLanguage}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                href="/cards/new"
              >
                <Plus size={16} />
                Add cards
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="relative">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("random")}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === "random"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <Shuffle size={14} />
              Random cards
            </button>

            <button
              type="button"
              onClick={() => setMode("writing")}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === "writing"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <PenLine size={14} />
              Writing
            </button>

            <button
              type="button"
              onClick={() => setMode("list")}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === "list"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <List size={14} />
              All cards
            </button>

            {mode !== "list" && cards.length > 0 ? (
              <select
                value={studyGroupFilter}
                onChange={(event) => setStudyGroupFilter(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="allGroups">All groups</option>
                <option value="unsorted">all (unsorted)</option>
                {groups.map((group) => (
                  <option
                    key={`study-group-select-${group.id}`}
                    value={group.id}
                  >
                    {group.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </section>

        <div className="min-h-0 flex-1 overflow-visible md:overflow-hidden">
          {isLoading ? (
            <article className="h-full overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8">
              <p className="text-zinc-600 dark:text-zinc-400">
                Loading cards...
              </p>
            </article>
          ) : cards.length === 0 ? (
            <article className="h-full overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8">
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <BookOpen size={20} />
                  No cards yet
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Add your first words or phrases and Card Flasher will generate
                  translation and explanation.
                </p>
                <Link
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  href="/cards/new"
                >
                  <Plus size={16} />
                  Add cards
                </Link>
              </div>
            </article>
          ) : mode === "random" ? (
            <div className="flex flex-col gap-3">
              {studyCards.length === 0 ? (
                <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    No cards match selected groups.
                  </p>
                </article>
              ) : null}

              {studyCards.length > 0 ? (
                <>
                  <article
                    className="cursor-pointer overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 md:p-8"
                    onClick={() => setRevealed((value) => !value)}
                  >
                    <div className="space-y-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <Hand size={14} />
                        Tap card to reveal
                      </p>

                      <h2 className="text-2xl font-semibold break-words md:text-3xl">
                        {activeCard?.phrase}
                      </h2>

                      {activeCard && revealed ? (
                        renderCardDetails(activeCard, { showPhrase: false })
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          Press Reveal to show translation and explanation.
                        </p>
                      )}
                    </div>
                  </article>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRevealed(true)}
                      disabled={!activeCard}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Hand size={16} />
                      Reveal
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!activeCard) {
                          return;
                        }

                        setIndex((value) =>
                          getRandomNextIndex(value, studyCards.length),
                        );
                        setRevealed(false);
                      }}
                      disabled={!activeCard}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowRight size={16} />
                      Next card
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : mode === "writing" ? (
            <div className="flex flex-col gap-3">
              <article className="overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8">
                {studyCards.length === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    No cards match selected groups.
                  </p>
                ) : null}

                {studyCards.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm">
                      <p>
                        <span className="font-semibold">Translation:</span>{" "}
                        {writingCard?.translation}
                      </p>
                      <p className="mt-2">
                        <span className="font-semibold">Description:</span>{" "}
                        {writingCard?.description_en}
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium">
                        Type the exact phrase
                      </span>
                      {writingChecked ? (
                        <div className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-[11px] text-lg font-mono leading-8 dark:border-zinc-600 dark:bg-zinc-950">
                          <div>
                            {buildWritingSegments(
                              writingCard?.phrase ?? "",
                              writingInput,
                            ).map((segment, segmentIndex) => (
                              <span
                                key={`segment-${segmentIndex}`}
                                className={getWritingToneClass(segment.tone)}
                              >
                                {segment.char}
                              </span>
                            ))}
                          </div>
                          {isWritingCorrect ? (
                            <p className="mt-2 text-sm leading-6 font-semibold text-emerald-700">
                              Perfect match ✅
                            </p>
                          ) : (
                            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                              <span className="font-semibold">
                                Correct answer:
                              </span>{" "}
                              {writingCard?.phrase}
                            </p>
                          )}
                        </div>
                      ) : (
                        <input
                          ref={writingInputRef}
                          value={writingInput}
                          onChange={(event) => {
                            setWritingInput(event.target.value);
                            setWritingChecked(false);
                          }}
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="none"
                          className="min-h-14 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-lg font-mono leading-8 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-zinc-400"
                          placeholder="Write phrase exactly"
                        />
                      )}
                    </label>
                  </div>
                ) : null}
              </article>

              {studyCards.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setWritingChecked(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      Check
                    </button>

                    <button
                      type="button"
                      onClick={goToNextWritingCard}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    >
                      <ArrowRight size={16} />
                      Next writing card
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    ⏎ Enter: check, then next card
                  </p>
                </>
              ) : null}
            </div>
          ) : (
            <section className="grid min-h-0 gap-3 md:h-full md:grid-cols-3 md:grid-rows-[minmax(0,1fr)]">
              <aside className="order-2 flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:order-1 md:col-span-2 md:h-full">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Your cards
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSelectMode((value) => !value);
                      setSelectedCardIds([]);
                    }}
                    className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    {isSelectMode ? "Cancel" : "Select"}
                  </button>
                </div>

                <input
                  value={listQuery}
                  onChange={(event) => setListQuery(event.target.value)}
                  placeholder="Search phrase or translation"
                  className="mb-2 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-zinc-400"
                />
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {unsortedFilteredCards.length > 0 ? (
                    <div className="grid grid-cols-2 content-start gap-2 lg:grid-cols-3 xl:grid-cols-4">
                      {unsortedFilteredCards.map((card) => (
                        <button
                          key={`unsorted-${card.id}`}
                          type="button"
                          onClick={() =>
                            isSelectMode
                              ? toggleCardSelection(card.id)
                              : setSelectedCardId(card.id)
                          }
                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                            isSelectMode
                              ? selectedCardIds.includes(card.id)
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              : selectedCard?.id === card.id
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {card.phrase}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {groupedFilteredCards.map((item) => (
                    <section
                      key={`grouped-list-${item.group.id}`}
                      className="space-y-2"
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {item.group.name}
                      </h3>
                      <div className="grid grid-cols-2 content-start gap-2 lg:grid-cols-3 xl:grid-cols-4">
                        {item.cards.map((card) => (
                          <button
                            key={`group-${item.group.id}-card-${card.id}`}
                            type="button"
                            onClick={() =>
                              isSelectMode
                                ? toggleCardSelection(card.id)
                                : setSelectedCardId(card.id)
                            }
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                              isSelectMode
                                ? selectedCardIds.includes(card.id)
                                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                : selectedCard?.id === card.id
                                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100"
                                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {card.phrase}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}

                  {filteredCards.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No cards found.
                    </p>
                  ) : null}
                </div>
              </aside>

              <article className="order-1 min-h-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:order-2 md:col-span-1 md:h-full md:p-6">
                {isSelectMode ? (
                  <div className="space-y-3">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Selected: {selectedCardIds.length}
                    </p>

                    <select
                      value={bulkGroupId}
                      onChange={(event) => setBulkGroupId(event.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                    >
                      <option value="">Choose group</option>
                      {groups.map((group) => (
                        <option
                          key={`bulk-right-group-${group.id}`}
                          value={group.id}
                        >
                          {group.name}
                        </option>
                      ))}
                    </select>

                    <div className="flex flex-wrap gap-2">
                      <input
                        value={bulkNewGroupName}
                        onChange={(event) =>
                          setBulkNewGroupName(event.target.value)
                        }
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                        placeholder="New group name"
                      />
                      <button
                        type="button"
                        onClick={() => void createBulkGroupInline()}
                        disabled={isCreatingBulkGroup}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isCreatingBulkGroup ? "Creating..." : "Create group"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void runBulkAction("moveToGroup")}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        Move to group
                      </button>

                      <button
                        type="button"
                        onClick={() => void runBulkAction("removeFromGroup")}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        Remove from group
                      </button>

                      <button
                        type="button"
                        onClick={() => void runBulkAction("regenerate")}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                      >
                        Regenerate
                      </button>

                      <button
                        type="button"
                        onClick={() => void runBulkAction("delete")}
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : selectedCard ? (
                  <div className="flex h-full min-h-0 flex-col">
                    <h2 className="text-2xl font-semibold break-words md:text-3xl">
                      {selectedCard.phrase}
                    </h2>
                    <div className="mt-2 min-h-0 flex-1 overflow-auto pr-1">
                      {renderCardDetails(selectedCard, { showPhrase: false })}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmDeleteCardId === selectedCard.id) {
                            void deleteCard(selectedCard.id);
                            return;
                          }

                          setConfirmDeleteCardId(selectedCard.id);
                        }}
                        disabled={deletingCardId === selectedCard.id}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {deletingCardId === selectedCard.id
                          ? "Deleting..."
                          : confirmDeleteCardId === selectedCard.id
                            ? "Confirm"
                            : "Delete card"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Select a card to view details.
                  </p>
                )}
              </article>
            </section>
          )}
        </div>
      </section>

      <footer className="px-1 pt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <p>
          by ijustseen ·{" "}
          <a
            href="https://github.com/ijustseen/card-flasher"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            GitHub
          </a>{" "}
          ·{" "}
          <a
            href="https://t.me/andr_ewtf"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Telegram
          </a>
        </p>
      </footer>

      {successMessage ? (
        <AppToast
          message={successMessage}
          variant="success"
          topClassName="top-4"
        />
      ) : null}

      {error ? (
        <AppToast message={error} variant="error" topClassName="top-20" />
      ) : null}
    </main>
  );
}
