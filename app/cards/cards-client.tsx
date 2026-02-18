"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Hand,
  LogOut,
  Plus,
  Save,
} from "lucide-react";

type Card = {
  id: number;
  phrase: string;
  translation: string;
  description_en: string;
};

type Props = {
  userEmail: string;
  initialTargetLanguage: string;
};

export default function CardsClient({
  userEmail,
  initialTargetLanguage,
}: Props) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState(initialTargetLanguage);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/cards", { cache: "no-store" });
        const result = (await response.json()) as {
          error?: string;
          cards?: Card[];
        };

        if (response.status === 401) {
          router.push("/login");
          router.refresh();
          return;
        }

        if (!response.ok) {
          throw new Error(result.error ?? "Failed to load cards.");
        }

        setCards(result.cards ?? []);
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Unknown error.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [router]);

  const activeCard = cards.length > 0 ? cards[index % cards.length] : null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function saveTargetLanguage() {
    try {
      setIsSavingLanguage(true);
      setError(null);

      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to save language.");
      }
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unknown error.";
      setError(message);
    } finally {
      setIsSavingLanguage(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 p-4 text-zinc-900 md:p-8">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <header className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                <BookOpen size={22} />
                Card Flasher
              </h1>
              <p className="text-sm text-zinc-600">{userEmail}</p>
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
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
            <label className="text-sm font-medium">Target language</label>
            <input
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 md:max-w-xs"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              placeholder="e.g. Russian, Spanish, German"
            />
            <button
              type="button"
              disabled={isSavingLanguage}
              onClick={saveTargetLanguage}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={15} />
              {isSavingLanguage ? "Saving..." : "Save"}
            </button>
          </div>
        </header>

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <article
          className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md md:p-8"
          onClick={() => setRevealed((value) => !value)}
        >
          {isLoading ? (
            <p className="text-zinc-600">Loading cards...</p>
          ) : !activeCard ? (
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <BookOpen size={20} />
                No cards yet
              </h2>
              <p className="text-zinc-600">
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
          ) : (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <Hand size={14} />
                Tap card to reveal
              </p>
              <h2 className="text-2xl font-semibold break-words md:text-3xl">
                {activeCard.phrase}
              </h2>

              {revealed ? (
                <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm">
                    <span className="font-semibold">Translation:</span>{" "}
                    {activeCard.translation}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Description:</span>{" "}
                    {activeCard.description_en}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  Press Reveal to show translation and explanation.
                </p>
              )}
            </div>
          )}
        </article>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            disabled={!activeCard}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
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
              setIndex((value) => (value + 1) % cards.length);
              setRevealed(false);
            }}
            disabled={!activeCard}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRight size={16} />
            Next card
          </button>
        </div>
      </section>
    </main>
  );
}
