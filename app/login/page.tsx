import DatabaseEnvGuard from "@/components/database-env-guard";
import LoginClient from "@/app/login/login-client";
import { isDatabaseConfigured } from "@/lib/session";

export default function LoginPage() {
  if (!isDatabaseConfigured()) {
    return <DatabaseEnvGuard />;
  }

  return <LoginClient />;
}
