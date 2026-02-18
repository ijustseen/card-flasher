import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/session";
import NewCardsClient from "@/app/cards/new/new-cards-client";

export default async function NewCardsPage() {
  const user = await getCurrentUserFromCookies();

  if (!user) {
    redirect("/login");
  }

  return <NewCardsClient initialTargetLanguage={user.targetLanguage} />;
}
