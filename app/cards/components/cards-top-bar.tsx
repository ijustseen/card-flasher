import Link from "next/link";
import { BookOpen, List, LogOut, PenLine, Plus, Shuffle } from "lucide-react";
import type { CardsMode, CardsTopBarHandlers } from "@/app/cards/contracts";
import type { Group } from "@/types/domain";

type Props = {
  userEmail: string;
  initialTargetLanguage: string;
  mode: CardsMode;
  cardsCount: number;
  studyGroupFilter: string;
  groups: Group[];
  handlers: CardsTopBarHandlers;
};

const actionLinkClass =
  "inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700";

const secondaryActionButtonClass =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800";

const groupFilterSelectClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-900";

function getModeButtonClass(isActive: boolean) {
  if (isActive) {
    return "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100";
  }

  return "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800";
}

export default function CardsTopBar({
  userEmail,
  initialTargetLanguage,
  mode,
  cardsCount,
  studyGroupFilter,
  groups,
  handlers,
}: Props) {
  return (
    <>
      <header className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <BookOpen size={22} />
              Card Flasher
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {userEmail} · Target: {initialTargetLanguage}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link className={actionLinkClass} href="/cards/new">
              <Plus size={16} />
              Add cards
            </Link>

            <button
              type="button"
              onClick={handlers.onLogout}
              className={secondaryActionButtonClass}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handlers.onModeChange("random")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${getModeButtonClass(mode === "random")}`}
          >
            <Shuffle size={14} />
            Random cards
          </button>

          <button
            type="button"
            onClick={() => handlers.onModeChange("writing")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${getModeButtonClass(mode === "writing")}`}
          >
            <PenLine size={14} />
            Writing
          </button>

          <button
            type="button"
            onClick={() => handlers.onModeChange("list")}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${getModeButtonClass(mode === "list")}`}
          >
            <List size={14} />
            All cards
          </button>

          {mode !== "list" && cardsCount > 0 ? (
            <select
              value={studyGroupFilter}
              onChange={(event) =>
                handlers.onStudyGroupFilterChange(event.target.value)
              }
              className={groupFilterSelectClass}
            >
              <option value="allGroups">All groups</option>
              <option value="unsorted">all (unsorted)</option>
              {groups.map((group) => (
                <option key={`study-group-select-${group.id}`} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </section>
    </>
  );
}
