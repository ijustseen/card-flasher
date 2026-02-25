import type { ReactNode } from "react";
import type { Card, Group } from "@/types/domain";

export type CardsMode = "random" | "writing" | "list";

export type CardsTopBarHandlers = {
  onModeChange: (mode: CardsMode) => void;
  onStudyGroupFilterChange: (value: string) => void;
  onLogout: () => void;
};

export type RandomModeHandlers = {
  onToggleReveal: () => void;
  onReveal: () => void;
  onNextCard: () => void;
};

export type WritingModeHandlers = {
  onWritingInputChange: (value: string) => void;
  onCheck: () => void;
  onNext: () => void;
  onRegenerateExamples: (cardId: number) => void;
};

export type ListBulkAction =
  | "delete"
  | "moveToGroup"
  | "removeFromGroup"
  | "regenerate";

export type ListModeHandlers = {
  onToggleSelectMode: () => void;
  onListQueryChange: (value: string) => void;
  onToggleCardSelection: (cardId: number) => void;
  onSelectCard: (cardId: number) => void;
  onBulkGroupIdChange: (value: string) => void;
  onBulkNewGroupNameChange: (value: string) => void;
  onCreateBulkGroupInline: () => void;
  onRunBulkAction: (action: ListBulkAction) => void;
  onDeleteCardClick: (cardId: number) => void;
};

export type GroupedCardsItem = {
  group: Group;
  cards: Card[];
};

export type CardDetailsRenderer = (
  card: Card,
  options?: { showPhrase?: boolean },
) => ReactNode;
