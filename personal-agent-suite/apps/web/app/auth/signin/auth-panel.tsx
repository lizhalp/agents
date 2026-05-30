"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";

type LoginState = {
  identifier: string;
  password: string;
};

const initialLoginState: LoginState = {
  identifier: "",
  password: ""
};

export function AuthPanel() {
  const [loginState, setLoginState] = useState(initialLoginState);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        identifier: loginState.identifier,
        password: loginState.password,
        redirect: false,
        callbackUrl: "/"
      });

      if (result?.error) {
        setLoginError("Invalid email, username, or password.");
        return;
      }

      window.location.assign(result?.url ?? "/");
    });
  }

  return (
    <section className="auth-shell">
      <div className="auth-brand-panel">
        <div className="relative z-10 grid h-full">
          <div className="mb-7 flex items-center gap-[18px]">
            <BrandMark size="large" />
            <div className="space-y-0.5 text-sm uppercase tracking-[0.34em] text-[#f2ebdfea]">
              <div>Personal</div>
              <div>Agent Suite</div>
            </div>
          </div>

          <div className="max-w-[640px]">
            <h1 className="m-0 font-display text-[clamp(3.7rem,7vw,6.2rem)] font-medium leading-[0.92] tracking-[-0.05em] text-[#f2ebdf]">
              Run your life
              <br />
              like an operating
              <br />
              system.
            </h1>
            <div className="mt-[18px] h-[3px] w-[68px] rounded-full bg-gradient-to-r from-sand to-[#e7d5ba1a]" />
            <p className="mt-5 max-w-[520px] text-[clamp(1.08rem,1.5vw,1.42rem)] leading-[1.45] text-[#d6dee6e6]">
              Personal Agent Suite orchestrates your goals, code, calendar, and opportunity so you can focus on the work
              only you can do.
            </p>
          </div>

          <div className="mt-[30px] grid max-w-[500px] content-end gap-3.5 self-end">
            <FeatureRow
              icon="◎"
              title="Goal-centric by design"
              body="Align daily actions with long-horizon outcomes and keep strategic context in view."
            />
            <FeatureRow
              icon="</>"
              title="Developer-native"
              body="Coordinate repos, browser tasks, and operating procedures from one decision surface."
            />
            <FeatureRow
              icon="◫"
              title="Calendar intelligence"
              body="Protect focus, time-block deliberately, and respond to commitments before they fragment your week."
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-6 border-t border-[#e7d5ba24] pt-[18px] text-[13px] text-[#b4bec7cc]">
            <span>Personal command center</span>
            <span>Autonomous where useful</span>
            <span>Built around your priorities</span>
          </div>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-form-mark mx-auto mb-3.5 grid size-[46px] place-items-center text-2xl text-accent">
            ◫
          </div>

          <div className="auth-form-header mb-[18px] text-center">
            <div className="text-[13px] uppercase tracking-[0.26em] text-[#e9edf0eb]">Personal Agent Suite</div>
            <p className="auth-form-subtitle mt-2 text-[17px] leading-[1.35] text-[#aab5c0]">
              Sign in with your local owner password or a configured OAuth provider.
            </p>
          </div>

          {loginError ? (
            <p role="alert" className="mt-3.5 rounded-2xl bg-[#ff76761a] px-[13px] py-[11px] text-[#ffb5b5]">
              {loginError}
            </p>
          ) : null}

          <form className="auth-form-grid mt-[18px] grid gap-3.5" onSubmit={handleLoginSubmit}>
            <Field>
              <FieldLabel htmlFor="identifier">Email or username</FieldLabel>
              <FieldInput
                id="identifier"
                name="identifier"
                autoComplete="username"
                placeholder="operator@example.com"
                value={loginState.identifier}
                onChange={(event) => setLoginState((current) => ({ ...current, identifier: event.target.value }))}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <FieldInput
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={loginState.password}
                onChange={(event) => setLoginState((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </Field>

            <div className="auth-form-meta flex flex-wrap justify-between gap-4 text-[13px] text-[#aab5c0]">
              <span>One NextAuth session</span>
              <span className="text-accent">Private deployment</span>
            </div>

            <SubmitButton pending={isPending}>Sign in to your suite</SubmitButton>
          </form>

          <div className="auth-divider mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3.5 text-xs uppercase tracking-[0.16em] text-[#aab5c0]">
            <span className="h-px bg-[#a3b5c72e]" />
            <span>or continue with</span>
            <span className="h-px bg-[#a3b5c72e]" />
          </div>

          <div className="auth-oauth-grid mt-3.5 grid grid-cols-2 gap-2.5">
            <OAuthButton label="Google" provider="google" />
            <OAuthButton label="GitHub" provider="github" />
          </div>

          <div className="auth-footer-panel mt-[18px] grid gap-2 border-t border-[#a3b5c729] pt-[18px]">
            <div className="flex flex-wrap justify-between gap-3 text-[13px] text-[#cad6dedb]">
              <span>Private by default</span>
              <span className="text-accent">No IdP proxy layer</span>
            </div>
            <p className="m-0 text-[13px] leading-[1.45] text-[#aab5c0]">
              OAuth access is limited to identities listed in the owner email or username allowlist.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuthMobileHero() {
  return (
    <section className="auth-mobile-hero" aria-hidden="true">
      <BrandMark size="small" />
      <div className="text-[11px] uppercase tracking-[0.28em] text-[#dce4dbdb]">Personal Agent Suite</div>
      <h1 className="m-0 max-w-60 font-display text-[clamp(2.35rem,11vw,3.3rem)] leading-[0.95] tracking-[-0.05em] text-[#f2ebdf]">
        Operate your week with clarity.
      </h1>
      <p className="m-0 max-w-[300px] text-sm leading-[1.45] text-[#d0dae1e0]">
        One command surface for planning, execution, and follow-through across your work and life systems.
      </p>
      <div className="absolute right-[-82px] top-[30px] size-[220px] rounded-full border border-accent/10" />
      <div className="absolute right-[26px] top-[82px] size-[140px] rounded-full border border-sand/10" />
    </section>
  );
}

function BrandMark({ size }: { size: "large" | "small" }) {
  const sizeClass = size === "large" ? "size-[68px] text-[32px]" : "size-[52px] text-2xl";

  return (
    <div
      className={`${sizeClass} grid place-items-center rounded-full border border-sand/60 bg-white/[0.02] font-display tracking-[0.08em] text-sand`}
    >
      PA
    </div>
  );
}

function Field({ children }: { children: ReactNode }) {
  return <label className="grid gap-2">{children}</label>;
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <span className="text-sm font-semibold text-[#aab5c0]" id={`${htmlFor}-label`}>
      {children}
    </span>
  );
}

function FieldInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="auth-input" />;
}

function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className="auth-submit">
      {pending ? "Working..." : children}
    </button>
  );
}

function FeatureRow({ body, icon, title }: { body: string; icon: string; title: string }) {
  return (
    <div className="grid grid-cols-[56px_1fr] items-start gap-3.5">
      <div className="grid size-14 place-items-center rounded-2xl border border-[#a3b5c738] bg-white/[0.02] text-[22px] text-accent">
        {icon}
      </div>
      <div>
        <div className="mb-1 text-xs uppercase tracking-[0.18em] text-[#f4ecdff5]">{title}</div>
        <p className="m-0 text-[15px] leading-[1.52] text-[#aab5c0]">{body}</p>
      </div>
    </div>
  );
}

function OAuthButton({ label, provider }: { label: string; provider: "google" | "github" }) {
  const icon = provider === "google" ? <GoogleIcon /> : <GitHubIcon />;

  return (
    <button
      type="button"
      className="auth-oauth-button"
      onClick={() => window.location.assign(`/auth/start/${provider}?callbackUrl=%2F`)}
    >
      <span aria-hidden="true" className="grid place-items-center">
        {icon}
      </span>
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.805 12.23c0-.79-.069-1.55-.198-2.28H12v4.32h5.498a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.047-4.4 3.047-7.68Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.76 0 5.07-.91 6.76-2.46l-3.3-2.56c-.91.61-2.08.97-3.46.97-2.66 0-4.91-1.8-5.72-4.22H2.87v2.64A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path d="M6.28 13.73a5.98 5.98 0 0 1 0-3.46V7.63H2.87a10 10 0 0 0 0 8.74l3.41-2.64Z" fill="#FBBC05" />
      <path
        d="M12 6.05c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.06 2.99 14.75 2 12 2a10 10 0 0 0-9.13 5.63l3.41 2.64C7.09 7.85 9.34 6.05 12 6.05Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.31 6.84 9.66.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.58 2.36 1.12 2.94.85.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.09 0-1.13.39-2.05 1.03-2.78-.1-.26-.45-1.32.1-2.74 0 0 .84-.28 2.75 1.06A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.36 1.9-1.34 2.75-1.06 2.75-1.06.54 1.42.2 2.48.1 2.74.64.73 1.03 1.65 1.03 2.78 0 3.96-2.34 4.82-4.57 5.08.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.24 10.24 0 0 0 22 12.22C22 6.58 17.52 2 12 2Z"
        fill="#f2ebdf"
      />
      <circle cx="12" cy="12" r="11" stroke="rgba(111, 200, 201, 0.35)" />
    </svg>
  );
}
