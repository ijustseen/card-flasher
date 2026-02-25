import { ArrowRight, Hand } from "lucide-react";
import type {
  CardDetailsRenderer,
  RandomModeHandlers,
} from "@/app/cards/contracts";
import type { Card } from "@/types/domain";

const secondaryActionButtonClass =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";

const primaryActionButtonClass =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";

type Props = {
  studyCards: Card[];
  activeCard: Card | null;
  revealed: boolean;
  handlers: RandomModeHandlers;
  renderCardDetails: CardDetailsRenderer;
};

export default function RandomModePanel({
  studyCards,
  activeCard,
  revealed,
  handlers,
  renderCardDetails,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {studyCards.length === 0 ? (
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No cards match selected groups.
          </p>
        </article>
      ) : null}

      {studyCards.length > 0 ? (
        <>
          <article
            className="cursor-pointer overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 md:p-8"
            onClick={handlers.onToggleReveal}
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
              onClick={handlers.onReveal}
              disabled={!activeCard}
              className={secondaryActionButtonClass}
            >
              <Hand size={16} />
              Reveal
            </button>

            <button
              type="button"
              onClick={handlers.onNextCard}
              disabled={!activeCard}
              className={primaryActionButtonClass}
            >
              <ArrowRight size={16} />
              Next card
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
