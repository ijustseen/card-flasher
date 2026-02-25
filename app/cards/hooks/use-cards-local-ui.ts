import { useCallback, useRef, useState } from "react";
import type { CardsMode } from "@/app/cards/contracts";

export function useCardsLocalUi() {
  const [studyGroupFilter, setStudyGroupFilter] = useState("allGroups");
  const [mode, setMode] = useState<CardsMode>("random");
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [bulkNewGroupName, setBulkNewGroupName] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [writingIndex, setWritingIndex] = useState(0);
  const [writingInput, setWritingInput] = useState("");
  const [writingChecked, setWritingChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<number | null>(
    null,
  );
  const writingInputRef = useRef<HTMLInputElement | null>(null);

  const handleStudyGroupFilterChange = useCallback((value: string) => {
    setStudyGroupFilter(value);
    setIndex(0);
    setWritingIndex(0);
    setWritingInput("");
    setWritingChecked(false);
  }, []);

  function toggleCardSelection(cardId: number) {
    setSelectedCardIds((current) =>
      current.includes(cardId)
        ? current.filter((item) => item !== cardId)
        : [...current, cardId],
    );
  }

  function handleSelectCard(cardId: number) {
    setSelectedCardId(cardId);
    setConfirmDeleteCardId(null);
  }

  function handleToggleSelectMode() {
    setIsSelectMode((value) => !value);
    setSelectedCardIds([]);
  }

  function handleWritingInputChange(value: string) {
    setWritingInput(value);
    setWritingChecked(false);
  }

  return {
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
  };
}
