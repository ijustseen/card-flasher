"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import AppToast from "@/components/app-toast";
import AppFooter from "@/components/app-footer";
import CardDetailsPresenter from "@/app/cards/components/card-details-presenter";
import CardsTopBar from "@/app/cards/components/cards-top-bar";
import ListModePanel from "@/app/cards/components/list-mode-panel";
import RandomModePanel from "@/app/cards/components/random-mode-panel";
import WritingModePanel from "@/app/cards/components/writing-mode-panel";
import { useCardsActions } from "@/app/cards/hooks/use-cards-actions";
import { useCardsData } from "@/app/cards/hooks/use-cards-data";
import { useCardsLocalUi } from "@/app/cards/hooks/use-cards-local-ui";
import type {
  CardDetailsRenderer,
  CardsTopBarHandlers,
  ListModeHandlers,
  RandomModeHandlers,
  WritingModeHandlers,
} from "@/app/cards/contracts";
import {
  filterCardsByListQuery,
  filterCardsByStudyGroup,
  getRandomNextIndex,
  splitFilteredCards,
} from "@/app/cards/cards-client-utils";
import type { Card } from "@/types/domain";

type Props = {
  userEmail: string;
  initialTargetLanguage: string;
};

export default function CardsClient({
  userEmail,
  initialTargetLanguage,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    studyGroupFilter,
    mode,
    isSelectMode,
    selectedCardIds,
    bulkGroupId,
    bulkNewGroupName,
    listQuery,
    index,
    selectedCardId,
    writingIndex,
    writingInput,
    writingChecked,
    revealed,
    confirmDeleteCardId,
    writingInputRef,
    setMode,
    setBulkGroupId,
    setBulkNewGroupName,
    setListQuery,
    setIndex,
    setSelectedCardId,
    setWritingIndex,
    setWritingInput,
    setWritingChecked,
    setRevealed,
    setConfirmDeleteCardId,
    setSelectedCardIds,
    setIsSelectMode,
    handleStudyGroupFilterChange,
    toggleCardSelection,
    handleSelectCard,
    handleToggleSelectMode,
    handleWritingInputChange,
  } = useCardsLocalUi();

  const handleUnauthorized = useCallback(() => {
    router.push("/login");
    router.refresh();
  }, [router]);

  const { cards, groups, isLoading, setCards, setGroups } = useCardsData({
    onUnauthorized: handleUnauthorized,
    setError,
    setSelectedCardId,
    setIndex,
    setWritingIndex,
  });

  const studyCards = useMemo(
    () => filterCardsByStudyGroup(cards, studyGroupFilter),
    [cards, studyGroupFilter],
  );

  const activeCard =
    studyCards.length > 0 ? studyCards[index % studyCards.length] : null;
  const filteredCards = useMemo(
    () => filterCardsByListQuery(cards, listQuery),
    [cards, listQuery],
  );
  const { unsortedFilteredCards, groupedFilteredCards } = useMemo(
    () => splitFilteredCards(filteredCards, groups),
    [filteredCards, groups],
  );
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

  const {
    regeneratingCardId,
    deletingCardId,
    isCreatingBulkGroup,
    logout,
    regenerateExamples,
    deleteCard,
    runBulkAction,
    createBulkGroupInline,
  } = useCardsActions({
    initialTargetLanguage,
    selectedCardIds,
    bulkGroupId,
    bulkNewGroupName,
    onUnauthorized: handleUnauthorized,
    onRouteRefresh: () => {
      router.refresh();
    },
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
  });

  const goToNextWritingCard = useCallback(() => {
    setWritingIndex((value) => getRandomNextIndex(value, studyCards.length));
    setWritingInput("");
    setWritingChecked(false);
  }, [studyCards.length, setWritingChecked, setWritingIndex, setWritingInput]);

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
  }, [mode, writingChecked, goToNextWritingCard, setWritingChecked]);

  useEffect(() => {
    if (mode !== "writing" || writingChecked) {
      return;
    }

    writingInputRef.current?.focus();
  }, [mode, writingChecked, writingCard?.id, writingInputRef]);

  const topBarHandlers = useMemo<CardsTopBarHandlers>(
    () => ({
      onModeChange: setMode,
      onStudyGroupFilterChange: handleStudyGroupFilterChange,
      onLogout: logout,
    }),
    [setMode, handleStudyGroupFilterChange, logout],
  );

  const randomModeHandlers = useMemo<RandomModeHandlers>(
    () => ({
      onToggleReveal: () => setRevealed((value) => !value),
      onReveal: () => setRevealed(true),
      onNextCard: () => {
        if (!activeCard) {
          return;
        }

        setIndex((value) => getRandomNextIndex(value, studyCards.length));
        setRevealed(false);
      },
    }),
    [activeCard, setIndex, setRevealed, studyCards.length],
  );

  const writingModeHandlers = useMemo<WritingModeHandlers>(
    () => ({
      onWritingInputChange: handleWritingInputChange,
      onCheck: () => setWritingChecked(true),
      onNext: goToNextWritingCard,
    }),
    [handleWritingInputChange, setWritingChecked, goToNextWritingCard],
  );

  const listModeHandlers = useMemo<ListModeHandlers>(
    () => ({
      onToggleSelectMode: handleToggleSelectMode,
      onListQueryChange: setListQuery,
      onToggleCardSelection: toggleCardSelection,
      onSelectCard: handleSelectCard,
      onBulkGroupIdChange: setBulkGroupId,
      onBulkNewGroupNameChange: setBulkNewGroupName,
      onCreateBulkGroupInline: () => {
        void createBulkGroupInline();
      },
      onRunBulkAction: (action) => {
        void runBulkAction(action);
      },
      onDeleteCardClick: (cardId) => {
        if (confirmDeleteCardId === cardId) {
          void deleteCard(cardId);
          return;
        }

        setConfirmDeleteCardId(cardId);
      },
    }),
    [
      handleToggleSelectMode,
      setListQuery,
      toggleCardSelection,
      handleSelectCard,
      setBulkGroupId,
      setBulkNewGroupName,
      createBulkGroupInline,
      runBulkAction,
      confirmDeleteCardId,
      deleteCard,
      setConfirmDeleteCardId,
    ],
  );

  const renderCardDetails = useCallback<CardDetailsRenderer>(
    (card: Card, options?: { showPhrase?: boolean }) => (
      <CardDetailsPresenter
        card={card}
        showPhrase={options?.showPhrase ?? true}
        regeneratingCardId={regeneratingCardId}
        onRegenerateExamples={(cardId) => {
          void regenerateExamples(cardId);
        }}
      />
    ),
    [regeneratingCardId, regenerateExamples],
  );

  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-zinc-100 p-4 text-zinc-900 dark:from-zinc-950 dark:to-zinc-950 dark:text-zinc-100 md:h-screen md:overflow-hidden md:p-8">
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 md:h-full md:overflow-hidden">
        <CardsTopBar
          userEmail={userEmail}
          initialTargetLanguage={initialTargetLanguage}
          mode={mode}
          cardsCount={cards.length}
          studyGroupFilter={studyGroupFilter}
          groups={groups}
          handlers={topBarHandlers}
        />

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
            <RandomModePanel
              studyCards={studyCards}
              activeCard={activeCard}
              revealed={revealed}
              handlers={randomModeHandlers}
              renderCardDetails={renderCardDetails}
            />
          ) : mode === "writing" ? (
            <WritingModePanel
              studyCards={studyCards}
              writingCard={writingCard}
              writingChecked={writingChecked}
              writingInput={writingInput}
              isWritingCorrect={isWritingCorrect}
              writingInputRef={writingInputRef}
              handlers={writingModeHandlers}
            />
          ) : (
            <ListModePanel
              isSelectMode={isSelectMode}
              selectedCardIds={selectedCardIds}
              selectedCardId={selectedCard?.id ?? null}
              listQuery={listQuery}
              filteredCards={filteredCards}
              unsortedFilteredCards={unsortedFilteredCards}
              groupedFilteredCards={groupedFilteredCards}
              groups={groups}
              bulkGroupId={bulkGroupId}
              bulkNewGroupName={bulkNewGroupName}
              isCreatingBulkGroup={isCreatingBulkGroup}
              selectedCard={selectedCard}
              confirmDeleteCardId={confirmDeleteCardId}
              deletingCardId={deletingCardId}
              handlers={listModeHandlers}
              renderCardDetails={renderCardDetails}
            />
          )}
        </div>
      </section>

      <AppFooter />

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
