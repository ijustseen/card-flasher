export default function AppFooter() {
  return (
    <footer className="px-1 pt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
      <p>
        by ijustseen ·{" "}
        <a
          href="https://github.com/ijustseen/card-flasher"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          GitHub
        </a>{" "}
        ·{" "}
        <a
          href="https://t.me/andr_ewtf"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Telegram
        </a>
      </p>
    </footer>
  );
}
