import { redirect } from "next/navigation";

import { AuthPanel } from "./auth-panel";
import { auth } from "../../../auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/");
  }

  return (
    <main
      className="auth-page"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24
      }}
    >
      <section className="auth-mobile-hero" aria-hidden="true">
        <div className="auth-mobile-hero-mark">PA</div>
        <div className="auth-mobile-hero-kicker">Personal Agent Suite</div>
        <h1 className="auth-mobile-hero-title">Operate your week with clarity.</h1>
        <p className="auth-mobile-hero-copy">
          One command surface for planning, execution, and follow-through across your work and life systems.
        </p>
        <div className="auth-mobile-hero-orbit auth-mobile-hero-orbit-one" />
        <div className="auth-mobile-hero-orbit auth-mobile-hero-orbit-two" />
      </section>
      <AuthPanel />
    </main>
  );
}
