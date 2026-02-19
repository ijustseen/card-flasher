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
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div
      className={`toast-enter fixed right-4 z-50 max-w-xs rounded-xl border px-4 py-3 text-sm shadow-md ${topClassName} ${toneClassName}`}
    >
      {message}
    </div>
  );
}
