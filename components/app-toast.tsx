type ToastVariant = "success" | "error";

type AppToastProps = {
  message: string;
  variant: ToastVariant;
  topClassName?: string;
};

export default function AppToast({
  message,
  variant,
  topClassName = "top-4",
}: AppToastProps) {
  const toneClassName =
    variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300";

  return (
    <div
      className={`toast-enter fixed right-4 z-50 max-w-xs rounded-xl border px-4 py-3 text-sm shadow-md ${topClassName} ${toneClassName}`}
    >
      {message}
    </div>
  );
}
