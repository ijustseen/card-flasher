import { redirect } from "next/navigation";
import DatabaseEnvGuard from "@/components/database-env-guard";
import { getCurrentUserFromCookies, isDatabaseConfigured } from "@/lib/session";
import NewCardsClient from "@/app/cards/new/new-cards-client";

export default async function NewCardsPage() {
  if (!isDatabaseConfigured()) {
    return <DatabaseEnvGuard />;
  }

  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect("/login");
  }

  return <NewCardsClient initialTargetLanguage={user.targetLanguage} />;
}
