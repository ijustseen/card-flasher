import type { ReactNode } from "react";
import type { Card } from "@/types/domain";

const sectionTitleClass = "font-semibold";

const regenerateButtonClass =
  "mt-2 rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";

type Props = {
  card: Card;
  showPhrase?: boolean;
  phraseNode?: ReactNode;
  regeneratingCardId: number | null;
  onRegenerateExamples: (cardId: number) => void;
  transformExample?: (example: string, card: Card) => string;
};

export default function CardDetailsPresenter({
  card,
  showPhrase = true,
  phraseNode,
  regeneratingCardId,
  onRegenerateExamples,
  transformExample,
}: Props) {
  return (
    <div className="space-y-3">
      {phraseNode ? (
        phraseNode
      ) : showPhrase ? (
        <h2 className="text-2xl font-semibold break-words md:text-3xl">
          {card.phrase}
        </h2>
      ) : null}

      <p className="text-sm">
        <span className={sectionTitleClass}>Translation:</span>{" "}
        {card.translation}
      </p>

      <p className="text-sm">
        <span className={sectionTitleClass}>Description:</span>{" "}
        {card.description_en}
      </p>

      <div className="text-sm">
        <p className={sectionTitleClass}>Examples:</p>
        {card.examples_en.length > 0 ? (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {card.examples_en.map((example, exampleIndex) => (
              <li key={`${card.id}-example-${exampleIndex}`}>
                {transformExample ? transformExample(example, card) : example}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            No examples available yet.
          </p>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRegenerateExamples(card.id);
          }}
          disabled={regeneratingCardId === card.id}
          className={regenerateButtonClass}
        >
          {regeneratingCardId === card.id
            ? "Generating..."
            : "Regenerate examples"}
        </button>
      </div>
    </div>
  );
}
