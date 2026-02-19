export default function DatabaseEnvGuard() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 md:px-8">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm dark:border-amber-700 dark:bg-amber-950/30 md:p-8">
        <h1 className="text-2xl font-semibold text-amber-950 dark:text-amber-200">
          Database is not configured
        </h1>
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-300 md:text-base">
          This deployment needs Neon/Postgres environment variables before the
          app can run.
        </p>

        <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4 text-sm text-zinc-800 dark:border-amber-700 dark:bg-zinc-900 dark:text-zinc-200">
          <p className="font-medium">Set these variables in your deployment:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>DATABASE_URL or POSTGRES_URL</li>
            <li>GOOGLE_API_KEY</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
