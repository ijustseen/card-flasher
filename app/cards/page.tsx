import { redirect } from "next/navigation";
import DatabaseEnvGuard from "@/components/database-env-guard";
import { getCurrentUserFromCookies, isDatabaseConfigured } from "@/lib/session";
import CardsClient from "@/app/cards/cards-client";

export default async function CardsPage() {
  if (!isDatabaseConfigured()) {
    return <DatabaseEnvGuard />;
  }

  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect("/login");
  }

  return (
    <CardsClient
      initialTargetLanguage={user.targetLanguage}
      userEmail={user.email}
    />
  );
}
