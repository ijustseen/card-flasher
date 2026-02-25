import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { readJsonSafe } from "@/lib/client-http";
import type { Card, Group } from "@/types/domain";

type Params = {
  onUnauthorized: () => void;
  setError: Dispatch<SetStateAction<string | null>>;
  setSelectedCardId: Dispatch<SetStateAction<number | null>>;
  setIndex: Dispatch<SetStateAction<number>>;
  setWritingIndex: Dispatch<SetStateAction<number>>;
};

export function useCardsData({
  onUnauthorized,
  setError,
  setSelectedCardId,
  setIndex,
  setWritingIndex,
}: Params) {
  const [cards, setCards] = useState<Card[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInitialData = useCallback(async () => {
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
        onUnauthorized();
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
  }, [onUnauthorized, setError, setIndex, setSelectedCardId, setWritingIndex]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  return {
    cards,
    groups,
    isLoading,
    setCards,
    setGroups,
    reloadInitialData: loadInitialData,
  };
}
