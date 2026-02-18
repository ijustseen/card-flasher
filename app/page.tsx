import { redirect } from "next/navigation";
import { getCurrentUserFromCookies } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUserFromCookies();

  if (user) {
    redirect("/cards");
  }

  redirect("/login");
}
