import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ListBulkAction } from "@/app/cards/contracts";
import { readJsonSafe } from "@/lib/client-http";
import type { Card, Group } from "@/types/domain";

type Params = {
  initialTargetLanguage: string;
  selectedCardIds: number[];
  bulkGroupId: string;
  bulkNewGroupName: string;
  onUnauthorized: () => void;
  onRouteRefresh: () => void;
  setCards: Dispatch<SetStateAction<Card[]>>;
  setGroups: Dispatch<SetStateAction<Group[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSuccessMessage: Dispatch<SetStateAction<string | null>>;
  setSelectedCardIds: Dispatch<SetStateAction<number[]>>;
  setIsSelectMode: Dispatch<SetStateAction<boolean>>;
  setBulkGroupId: Dispatch<SetStateAction<string>>;
  setBulkNewGroupName: Dispatch<SetStateAction<string>>;
  setSelectedCardId: Dispatch<SetStateAction<number | null>>;
  setIndex: Dispatch<SetStateAction<number>>;
  setWritingIndex: Dispatch<SetStateAction<number>>;
  setConfirmDeleteCardId: Dispatch<SetStateAction<number | null>>;
};

export function useCardsActions({
  initialTargetLanguage,
  selectedCardIds,
  bulkGroupId,
  bulkNewGroupName,
  onUnauthorized,
  onRouteRefresh,
  setCards,
  setGroups,
  setError,
  setSuccessMessage,
  setSelectedCardIds,
  setIsSelectMode,
  setBulkGroupId,
  setBulkNewGroupName,
  setSelectedCardId,
  setIndex,
  setWritingIndex,
  setConfirmDeleteCardId,
}: Params) {
  const [regeneratingCardId, setRegeneratingCardId] = useState<number | null>(
    null,
  );
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null);
  const [isCreatingBulkGroup, setIsCreatingBulkGroup] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  function setSuccessToast(message: string) {
    setSuccessMessage(message);

    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }

    successTimerRef.current = setTimeout(() => {
      setSuccessMessage(null);
    }, 2500);
  }

  function isUnauthorized(status: number) {
    if (status !== 401) {
      return false;
    }

    onUnauthorized();
    return true;
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    onUnauthorized();
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

      if (isUnauthorized(response.status)) {
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

      setSuccessToast("Examples updated.");
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

      if (isUnauthorized(response.status)) {
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

      setSuccessToast("Card deleted.");
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Unknown error.";
      setError(message);
    } finally {
      setDeletingCardId(null);
    }
  }

  async function runBulkAction(action: ListBulkAction) {
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

      if (isUnauthorized(response.status)) {
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Bulk action failed.");
      }

      setSuccessToast("Bulk action completed.");
      setSelectedCardIds([]);
      setIsSelectMode(false);
      setBulkGroupId("");

      await refreshLocalCardsAndGroups();
      onRouteRefresh();
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

      if (isUnauthorized(response.status)) {
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

  return {
    regeneratingCardId,
    deletingCardId,
    isCreatingBulkGroup,
    logout,
    regenerateExamples,
    deleteCard,
    runBulkAction,
    createBulkGroupInline,
  };
}
