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
  const [mode, setMode] = useState<Mode>("random");
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

        const response = await fetch("/api/cards", { cache: "no-store" });
        const result = await readJsonSafe<{
          error?: string;
          cards?: Card[];
        }>(response, {});

        if (response.status === 401) {
          router.push("/login");
          router.refresh();
          return;
        }

        if (!response.ok) {
          throw new Error(result.error ?? "Failed to load cards.");
        }

        const nextCards = result.cards ?? [];
        setCards(nextCards);

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

  const activeCard = cards.length > 0 ? cards[index % cards.length] : null;
  const selectedCard =
    cards.find((card) => card.id === selectedCardId) ?? cards[0] ?? null;
  const writingCard =
    cards.length > 0 ? cards[writingIndex % cards.length] : null;

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
          expected[expectedIndex - 1] === actual[actualIndex - 1] ? 0 : 1;

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
            (expectedChar === actualChar ? 0 : 1)
      ) {
        segments.push({
          char: actualChar,
          tone: expectedChar === actualChar ? "good" : "bad",
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

  const goToNextWritingCard = useCallback(() => {
    setWritingIndex((value) => getRandomNextIndex(value, cards.length));
    setWritingInput("");
    setWritingChecked(false);
  }, [cards.length]);

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
    <main className="relative min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 p-4 text-zinc-900 dark:from-zinc-950 dark:to-zinc-950 dark:text-zinc-100 md:p-8">
      <section className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col gap-4 overflow-y-auto pb-8 md:max-h-[calc(100vh-4rem)]">
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

        <section>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("random")}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                mode === "random"
                  ? "border-zinc-900 bg-zinc-900 text-white"
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
                  ? "border-zinc-900 bg-zinc-900 text-white"
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
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <List size={14} />
              All cards
            </button>
          </div>
        </section>

        <div className="min-h-0 flex-1 overflow-hidden">
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
            <div className="flex h-full flex-col gap-3">
              <article
                className="min-h-0 flex-1 cursor-pointer overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 md:p-8"
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
                      getRandomNextIndex(value, cards.length),
                    );
                    setRevealed(false);
                  }}
                  disabled={!activeCard}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowRight size={16} />
                  Next card
                </button>
              </div>
            </div>
          ) : mode === "writing" ? (
            <article className="h-full overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8">
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
                      {writingCard && writingInput === writingCard.phrase ? (
                        <p className="mt-2 text-sm leading-6 font-semibold text-emerald-700">
                          Perfect match ✅
                        </p>
                      ) : (
                        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                          <span className="font-semibold">Correct answer:</span>{" "}
                          {writingCard?.phrase}
                        </p>
                      )}
                    </div>
                  ) : (
                    <input
                      value={writingInput}
                      onChange={(event) => {
                        setWritingInput(event.target.value);
                        setWritingChecked(false);
                      }}
                      className="min-h-14 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-lg font-mono leading-8 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-zinc-400"
                      placeholder="Write phrase exactly"
                    />
                  )}
                </label>

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
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    <ArrowRight size={16} />
                    Next writing card
                  </button>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  ⏎ Enter: check, then next card
                </p>
              </div>
            </article>
          ) : (
            <section className="grid h-full min-h-0 gap-3 md:grid-cols-3">
              <aside className="flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:col-span-2">
                <p className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Your cards
                </p>
                <div className="grid max-h-[52vh] min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pr-1 md:max-h-[56vh] lg:grid-cols-3 xl:grid-cols-4">
                  {cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedCardId(card.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        selectedCard?.id === card.id
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {card.phrase}
                    </button>
                  ))}
                </div>
              </aside>

              <article className="min-h-0 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:col-span-1 md:p-6">
                {selectedCard ? (
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="min-h-0 flex-1 overflow-auto pr-1">
                      {renderCardDetails(selectedCard, { showPhrase: true })}
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

      <footer className="pointer-events-auto fixed right-0 bottom-2 left-0 z-30 px-4 text-center text-xs text-zinc-500 dark:text-zinc-400 md:px-8">
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
