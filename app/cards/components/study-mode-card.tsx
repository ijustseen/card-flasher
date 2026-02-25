import type { ReactNode } from "react";

type Props = {
  label: string;
  icon: ReactNode;
  onCardClick?: () => void;
  children: ReactNode;
};

export default function StudyModeCard({
  label,
  icon,
  onCardClick,
  children,
}: Props) {
  const interactiveClass = onCardClick
    ? "cursor-pointer transition hover:shadow-md"
    : "";

  return (
    <article
      className={`overflow-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:p-8 ${interactiveClass}`.trim()}
      onClick={onCardClick}
    >
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {icon}
          {label}
        </p>

        {children}
      </div>
    </article>
  );
}
