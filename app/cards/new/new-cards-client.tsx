"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, PenLine, Plus, X } from "lucide-react";
import AppToast from "@/components/app-toast";

type Props = {
  initialTargetLanguage: string;
};

export default function NewCardsClient({ initialTargetLanguage }: Props) {
  const router = useRouter();
  const [targetLanguage, setTargetLanguage] = useState(initialTargetLanguage);
  const [phrases, setPhrases] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePhrase(index: number, value: string) {
    setPhrases((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function addField() {
    setPhrases((current) => [...current, ""]);
  }

  function removeField(index: number) {
    setPhrases((current) => {
      if (current.length <= 1) {
        return [""];
      }

      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function chunkPhrases(items: string[], chunkSize: number) {
    const chunks: string[][] = [];

    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }

    return chunks;
  }

  async function confirmCards() {
    const cleaned = phrases.map((item) => item.trim()).filter(Boolean);

    if (cleaned.length === 0) {
      setError("Please add at least one phrase.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const phraseBatches = chunkPhrases(cleaned, 50);

      for (const batch of phraseBatches) {
        const response = await fetch("/api/cards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phrases: batch, targetLanguage }),
        });

        let result: { error?: string } = {};

        try {
          result = (await response.json()) as { error?: string };
        } catch {
          result = {};
        }

        if (response.status === 401) {
          router.push("/login");
          router.refresh();
          return;
        }

        if (!response.ok) {
          throw new Error(
            result.error ??
              `Failed to generate cards (HTTP ${response.status}). Please try again.`,
          );
        }
      }

      router.push("/cards");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unknown error.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 p-4 text-zinc-900 md:p-8">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-sm backdrop-blur md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <PenLine size={22} />
            Add cards
          </h1>
          <Link
            href="/cards"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          >
            <ArrowLeft size={16} />
            Back to cards
          </Link>
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          Enter words or phrases in English. We will generate translation and
          English explanation.
        </p>

        <label className="mt-5 block">
          <span className="mb-1 block text-sm font-medium">
            Target language
          </span>
          <input
            value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 md:max-w-sm"
            placeholder="e.g. Russian"
          />
        </label>

        <div className="mt-5 space-y-2">
          {phrases.map((value, index) => (
            <div
              key={`${index}-${phrases.length}`}
              className="flex items-center gap-2"
            >
              <input
                value={value}
                onChange={(event) => updatePhrase(index, event.target.value)}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
                placeholder="Type word or phrase"
              />

              <button
                type="button"
                onClick={() => removeField(index)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                aria-label={`Remove phrase ${index + 1}`}
                title="Remove field"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addField}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
          >
            <Plus size={16} />
            Add field
          </button>

          <button
            type="button"
            onClick={confirmCards}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check size={16} />
            {isSubmitting ? "Generating..." : "Confirm cards"}
          </button>
        </div>
      </section>

      {error ? (
        <AppToast message={error} variant="error" topClassName="top-4" />
      ) : null}
    </main>
  );
}
