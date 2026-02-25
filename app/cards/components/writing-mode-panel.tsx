import { ArrowRight } from "lucide-react";
import type { RefObject } from "react";
import type { WritingModeHandlers } from "@/app/cards/contracts";
import {
  buildWritingSegments,
  getWritingToneClass,
} from "@/app/cards/cards-client-utils";
import type { Card } from "@/types/domain";

const textInputClass =
  "min-h-14 w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-2 text-lg font-mono leading-8 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:focus:border-zinc-400";

const secondaryActionButtonClass =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800";

const primaryActionButtonClass =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800";

type Props = {
  studyCards: Card[];
  writingCard: Card | null;
  writingChecked: boolean;
  writingInput: string;
  isWritingCorrect: boolean;
  writingInputRef: RefObject<HTMLInputElement | null>;
  handlers: WritingModeHandlers;
};

export default function WritingModePanel({
  studyCards,
  writingCard,
  writingChecked,
  writingInput,
  isWritingCorrect,
  writingInputRef,
  handlers,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <article className="overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8">
        {studyCards.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No cards match selected groups.
          </p>
        ) : null}

        {studyCards.length > 0 ? (
          <div className="space-y-4">
            <div className="text-sm">
              <p>
                <span className="font-semibold">Translation:</span>{" "}
                {writingCard?.translation}
              </p>
              <p className="mt-2">
                <span className="font-semibold">Description:</span>{" "}
                {writingCard?.description_en}
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Type the exact phrase
              </span>
              {writingChecked ? (
                <div className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-[11px] text-lg font-mono leading-8 dark:border-zinc-600 dark:bg-zinc-950">
                  <div>
                    {buildWritingSegments(
                      writingCard?.phrase ?? "",
                      writingInput,
                    ).map((segment, segmentIndex) => (
                      <span
                        key={`segment-${segmentIndex}`}
                        className={getWritingToneClass(segment.tone)}
                      >
                        {segment.char}
                      </span>
                    ))}
                  </div>
                  {isWritingCorrect ? (
                    <p className="mt-2 text-sm leading-6 font-semibold text-emerald-700">
                      Perfect match ✅
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                      <span className="font-semibold">Correct answer:</span>{" "}
                      {writingCard?.phrase}
                    </p>
                  )}
                </div>
              ) : (
                <input
                  ref={writingInputRef}
                  value={writingInput}
                  onChange={(event) =>
                    handlers.onWritingInputChange(event.target.value)
                  }
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  className={textInputClass}
                  placeholder="Write phrase exactly"
                />
              )}
            </label>
          </div>
        ) : null}
      </article>

      {studyCards.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlers.onCheck}
              className={secondaryActionButtonClass}
            >
              Check
            </button>

            <button
              type="button"
              onClick={handlers.onNext}
              className={primaryActionButtonClass}
            >
              <ArrowRight size={16} />
              Next writing card
            </button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            ⏎ Enter: check, then next card
          </p>
        </>
      ) : null}
    </div>
  );
}
