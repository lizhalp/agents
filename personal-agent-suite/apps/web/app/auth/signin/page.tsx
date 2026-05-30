import { redirect } from "next/navigation";

import { AuthMobileHero, AuthPanel } from "./auth-panel";
import { auth } from "../../../auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="auth-page">
      <AuthMobileHero />
      <AuthPanel />
    </main>
  );
}
