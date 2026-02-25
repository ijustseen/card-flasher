import { Trash2 } from "lucide-react";
import type {
  CardDetailsRenderer,
  GroupedCardsItem,
  ListModeHandlers,
} from "@/app/cards/contracts";
import type { Card, Group } from "@/types/domain";

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900";

const neutralActionButtonClass =
  "rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800";

const dangerActionButtonClass =
  "rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50";

type Props = {
  isSelectMode: boolean;
  selectedCardIds: number[];
  selectedCardId: number | null;
  listQuery: string;
  filteredCards: Card[];
  unsortedFilteredCards: Card[];
  groupedFilteredCards: GroupedCardsItem[];
  groups: Group[];
  bulkGroupId: string;
  bulkNewGroupName: string;
  isCreatingBulkGroup: boolean;
  selectedCard: Card | null;
  confirmDeleteCardId: number | null;
  deletingCardId: number | null;
  handlers: ListModeHandlers;
  renderCardDetails: CardDetailsRenderer;
};

function getCardButtonClass(options: {
  isSelectMode: boolean;
  isSelectedInSelectMode: boolean;
  isActiveCard: boolean;
}) {
  if (options.isSelectMode && options.isSelectedInSelectMode) {
    return "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100";
  }

  if (!options.isSelectMode && options.isActiveCard) {
    return "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100";
  }

  return "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";
}

export default function ListModePanel({
  isSelectMode,
  selectedCardIds,
  selectedCardId,
  listQuery,
  filteredCards,
  unsortedFilteredCards,
  groupedFilteredCards,
  groups,
  bulkGroupId,
  bulkNewGroupName,
  isCreatingBulkGroup,
  selectedCard,
  confirmDeleteCardId,
  deletingCardId,
  handlers,
  renderCardDetails,
}: Props) {
  return (
    <section className="grid min-h-0 gap-3 md:h-full md:grid-cols-3 md:grid-rows-[minmax(0,1fr)]">
      <aside className="order-2 flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:order-1 md:col-span-2 md:h-full">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Your cards
          </p>
          <button
            type="button"
            onClick={handlers.onToggleSelectMode}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {isSelectMode ? "Cancel" : "Select"}
          </button>
        </div>

        <input
          value={listQuery}
          onChange={(event) => handlers.onListQueryChange(event.target.value)}
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
                      ? handlers.onToggleCardSelection(card.id)
                      : handlers.onSelectCard(card.id)
                  }
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${getCardButtonClass(
                    {
                      isSelectMode,
                      isSelectedInSelectMode: selectedCardIds.includes(card.id),
                      isActiveCard: selectedCardId === card.id,
                    },
                  )}`}
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
                        ? handlers.onToggleCardSelection(card.id)
                        : handlers.onSelectCard(card.id)
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${getCardButtonClass(
                      {
                        isSelectMode,
                        isSelectedInSelectMode: selectedCardIds.includes(
                          card.id,
                        ),
                        isActiveCard: selectedCardId === card.id,
                      },
                    )}`}
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
              onChange={(event) =>
                handlers.onBulkGroupIdChange(event.target.value)
              }
              className={fieldClass}
            >
              <option value="">Choose group</option>
              {groups.map((group) => (
                <option key={`bulk-right-group-${group.id}`} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <input
                value={bulkNewGroupName}
                onChange={(event) =>
                  handlers.onBulkNewGroupNameChange(event.target.value)
                }
                className={fieldClass}
                placeholder="New group name"
              />
              <button
                type="button"
                onClick={handlers.onCreateBulkGroupInline}
                disabled={isCreatingBulkGroup}
                className={`${neutralActionButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isCreatingBulkGroup ? "Creating..." : "Create group"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlers.onRunBulkAction("moveToGroup")}
                className={neutralActionButtonClass}
              >
                Move to group
              </button>

              <button
                type="button"
                onClick={() => handlers.onRunBulkAction("removeFromGroup")}
                className={neutralActionButtonClass}
              >
                Remove from group
              </button>

              <button
                type="button"
                onClick={() => handlers.onRunBulkAction("regenerate")}
                className={neutralActionButtonClass}
              >
                Regenerate
              </button>

              <button
                type="button"
                onClick={() => handlers.onRunBulkAction("delete")}
                className={dangerActionButtonClass}
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
                onClick={() => handlers.onDeleteCardClick(selectedCard.id)}
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
  );
}
