"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, PenLine, Plus, X } from "lucide-react";
import AppToast from "@/components/app-toast";
import { readJsonSafe } from "@/lib/client-http";
import type { Group } from "@/types/domain";

type Props = {
  initialTargetLanguage: string;
};

export default function NewCardsClient({ initialTargetLanguage }: Props) {
  const router = useRouter();
  const [targetLanguage, setTargetLanguage] = useState(initialTargetLanguage);
  const [phrases, setPhrases] = useState<string[]>([""]);
  const [existingPhrases, setExistingPhrases] = useState<Set<string>>(
    new Set(),
  );
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [invalidPhraseIndexes, setInvalidPhraseIndexes] = useState<number[]>(
    [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function normalizePhrase(value: string) {
    return value.trim().toLocaleLowerCase();
  }

  useEffect(() => {
    void (async () => {
      try {
        const [cardsResponse, groupsResponse] = await Promise.all([
          fetch("/api/cards", { cache: "no-store" }),
          fetch("/api/groups", { cache: "no-store" }),
        ]);

        const cardsResult = await readJsonSafe<{
          error?: string;
          cards?: Array<{ phrase: string }>;
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
          throw new Error(
            cardsResult.error ?? "Failed to load existing cards.",
          );
        }

        if (!groupsResponse.ok) {
          throw new Error(groupsResult.error ?? "Failed to load groups.");
        }

        setExistingPhrases(
          new Set(
            (cardsResult.cards ?? []).map((card) =>
              normalizePhrase(card.phrase),
            ),
          ),
        );
        setGroups(groupsResult.groups ?? []);
      } catch {
        setExistingPhrases(new Set());
        setGroups([]);
      }
    })();
  }, [router]);

  function toggleGroup(groupId: number) {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((item) => item !== groupId)
        : [...current, groupId],
    );
  }

  async function createGroupInline() {
    const name = newGroupName.trim();

    if (!name) {
      setError("Group name is required.");
      return;
    }

    try {
      setIsCreatingGroup(true);
      setError(null);

      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const result = await readJsonSafe<{
        error?: string;
        group?: Group;
      }>(response, {});

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

      setSelectedGroupIds((current) =>
        current.includes(result.group!.id)
          ? current
          : [...current, result.group!.id],
      );
      setNewGroupName("");
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : "Unknown error.";
      setError(message);
    } finally {
      setIsCreatingGroup(false);
    }
  }

  function updatePhrase(index: number, value: string) {
    setInvalidPhraseIndexes((current) =>
      current.filter((item) => item !== index),
    );

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
    setInvalidPhraseIndexes((current) =>
      current
        .filter((item) => item !== index)
        .map((item) => (item > index ? item - 1 : item)),
    );

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
    const normalizedEntries = phrases
      .map((value, index) => ({
        index,
        raw: value.trim(),
        normalized: normalizePhrase(value),
      }))
      .filter((item) => item.raw.length > 0);

    const cleaned = normalizedEntries.map((item) => item.raw);

    if (cleaned.length === 0) {
      setInvalidPhraseIndexes([]);
      setError("Please add at least one phrase.");
      return;
    }

    const firstIndexByPhrase = new Map<string, number>();
    const duplicateInInputIndexes = new Set<number>();

    for (const entry of normalizedEntries) {
      const firstIndex = firstIndexByPhrase.get(entry.normalized);

      if (firstIndex === undefined) {
        firstIndexByPhrase.set(entry.normalized, entry.index);
      } else {
        duplicateInInputIndexes.add(firstIndex);
        duplicateInInputIndexes.add(entry.index);
      }
    }

    if (duplicateInInputIndexes.size > 0) {
      setInvalidPhraseIndexes([...duplicateInInputIndexes]);
      setError("Duplicate phrases in the form.");
      return;
    }

    const duplicateInCardsIndexes = normalizedEntries
      .filter((entry) => existingPhrases.has(entry.normalized))
      .map((entry) => entry.index);

    if (duplicateInCardsIndexes.length > 0) {
      setInvalidPhraseIndexes(duplicateInCardsIndexes);
      setError("Some phrases already exist in your cards.");
      return;
    }

    setInvalidPhraseIndexes([]);
    setError(null);
    setIsSubmitting(true);

    try {
      const phraseBatches = chunkPhrases(cleaned, 50);

      for (const batch of phraseBatches) {
        const response = await fetch("/api/cards/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phrases: batch,
            targetLanguage,
            groupIds: selectedGroupIds,
          }),
        });

        const result = await readJsonSafe<{ error?: string }>(response, {});

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
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 p-4 text-zinc-900 dark:from-zinc-950 dark:to-zinc-900 dark:text-zinc-100 md:p-8">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <PenLine size={22} />
            Add cards
          </h1>
          <Link
            href="/cards"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <ArrowLeft size={16} />
            Back to cards
          </Link>
        </div>

        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
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
            className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400 md:max-w-sm"
            placeholder="e.g. Russian"
          />
        </label>

        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-sm font-medium">Groups for this batch</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            If none selected, cards stay in unsorted (`all`).
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {groups.map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={selectedGroupIds.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                />
                <span className="truncate">
                  {group.name}{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">
                    ({group.cardCount})
                  </span>
                </span>
              </label>
            ))}

            {groups.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No custom groups yet.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400 sm:max-w-xs"
              placeholder="New group name"
            />
            <button
              type="button"
              onClick={() => void createGroupInline()}
              disabled={isCreatingGroup}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              {isCreatingGroup ? "Creating..." : "Create group"}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {phrases.map((value, index) => (
            <div
              key={`${index}-${phrases.length}`}
              className="flex items-center gap-2"
            >
              <input
                value={value}
                onChange={(event) => updatePhrase(index, event.target.value)}
                className={`w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none dark:bg-zinc-900 ${
                  invalidPhraseIndexes.includes(index)
                    ? "border-red-500 focus:border-red-500 dark:border-red-400 dark:focus:border-red-300"
                    : "border-zinc-300 focus:border-zinc-500 dark:border-zinc-600 dark:focus:border-zinc-400"
                }`}
                placeholder="Type word or phrase"
              />

              <button
                type="button"
                onClick={() => removeField(index)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
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
