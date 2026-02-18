import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/session";
import CardsClient from "@/app/cards/cards-client";

export default async function CardsPage() {
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
