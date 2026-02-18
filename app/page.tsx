import { redirect } from "next/navigation";
import DatabaseEnvGuard from "@/components/database-env-guard";
import { getCurrentUserFromCookies, isDatabaseConfigured } from "@/lib/session";

export default async function Home() {
  if (!isDatabaseConfigured()) {
    return <DatabaseEnvGuard />;
  }

  const user = await getCurrentUserFromCookies();

  if (user) {
    redirect("/cards");
  }

  redirect("/login");
}
