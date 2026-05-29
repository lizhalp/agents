"use client";

import { useState, useTransition } from "react";

import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";

type LoginState = {
  identifier: string;
  password: string;
};

type RegisterState = {
  email: string;
  name: string;
  password: string;
  username: string;
};

type RegisterField = keyof RegisterState;

type RegisterErrors = Partial<Record<RegisterField, string>>;

const initialLoginState: LoginState = {
  identifier: "",
  password: ""
};

const initialRegisterState: RegisterState = {
  email: "",
  name: "",
  password: "",
  username: ""
};

export function AuthPanel() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginState, setLoginState] = useState(initialLoginState);
  const [registerState, setRegisterState] = useState(initialRegisterState);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/local-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            identifier: loginState.identifier,
            password: loginState.password
          })
        });

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to sign in.");
        }

        window.location.assign("/auth/start/authentik?callbackUrl=%2F");
      } catch (loginError) {
        setLoginError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
      }
    });
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterError(null);
    const nextValidationErrors = validateRegisterState(registerState);
    setRegisterErrors(nextValidationErrors);
    setNotice(null);

    if (Object.keys(nextValidationErrors).length > 0) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(registerState)
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          fieldErrors?: RegisterErrors;
        };
        if (!response.ok) {
          if (payload.fieldErrors) {
            setRegisterErrors(payload.fieldErrors);
          }
          throw new Error(payload.error ?? "Unable to register.");
        }

        setRegisterErrors({});
        setNotice("Account created. Signing you in.");
        const loginResponse = await fetch("/api/local-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            identifier: registerState.username,
            password: registerState.password
          })
        });
        const loginPayload = (await loginResponse.json().catch(() => ({}))) as { error?: string };
        if (!loginResponse.ok) {
          throw new Error(loginPayload.error ?? "Unable to sign in.");
        }

        window.location.assign("/auth/start/authentik?callbackUrl=%2F");
      } catch (registerError) {
        setRegisterError(registerError instanceof Error ? registerError.message : "Unable to register.");
      }
    });
  }

  return (
    <section
      className="auth-shell"
      style={{
        width: "min(1280px, 100%)",
        minHeight: "min(760px, calc(100vh - 48px))",
        border: "1px solid rgba(231, 213, 186, 0.16)",
        borderRadius: 32,
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(9, 16, 28, 0.98), rgba(8, 18, 31, 0.98))",
        boxShadow: "0 30px 120px rgba(0, 0, 0, 0.42)"
      }}
    >
      <div
        className="auth-brand-panel"
        style={{
          position: "relative",
          padding: "34px clamp(24px, 3.2vw, 48px) 28px",
          background:
            "radial-gradient(circle at 75% 78%, rgba(231, 197, 133, 0.22), transparent 18%), radial-gradient(circle at 72% 20%, rgba(111, 200, 201, 0.1), transparent 24%), linear-gradient(135deg, rgba(9, 17, 29, 0.98), rgba(7, 13, 22, 0.92))"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 64% 46%, rgba(255,255,255,0.04), transparent 22%), linear-gradient(90deg, transparent 0%, rgba(119, 161, 182, 0.08) 49%, transparent 50%)",
            maskImage:
              "radial-gradient(circle at center, black 60%, transparent 100%)"
          }}
        />
        <div style={{ position: "relative", zIndex: 1, display: "grid", height: "100%" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              marginBottom: 28
            }}
          >
            <div
              className="auth-brand-mark"
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                border: "1px solid rgba(231, 213, 186, 0.68)",
                display: "grid",
                placeItems: "center",
                color: "var(--sand)",
                fontFamily: "var(--font-display), serif",
                fontSize: 32,
                letterSpacing: "0.08em"
              }}
            >
              PA
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: "0.34em",
                  textTransform: "uppercase",
                  color: "rgba(242, 235, 223, 0.92)"
                }}
              >
                Personal
              </div>
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: "0.34em",
                  textTransform: "uppercase",
                  color: "rgba(242, 235, 223, 0.92)"
                }}
              >
                Agent Suite
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 640 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display), serif",
                fontWeight: 500,
                fontSize: "clamp(3.7rem, 7vw, 6.2rem)",
                lineHeight: 0.92,
                letterSpacing: "-0.05em",
                color: "var(--text)"
              }}
            >
              Run your life
              <br />
              like an operating
              <br />
              system.
            </h1>

            <div
              style={{
                width: 68,
                height: 3,
                borderRadius: 999,
                background: "linear-gradient(90deg, var(--sand), rgba(231, 213, 186, 0.1))",
                marginTop: 18
              }}
            />

            <p
              style={{
                margin: "20px 0 0",
                maxWidth: 520,
                color: "rgba(214, 222, 228, 0.9)",
                lineHeight: 1.45,
                fontSize: "clamp(1.08rem, 1.5vw, 1.42rem)"
              }}
            >
              Personal Agent Suite orchestrates your goals, code, calendar, and opportunity so you can focus on the work
              only you can do.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: 14,
              alignSelf: "end",
              marginTop: 30,
              maxWidth: 500
            }}
          >
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
              alignItems: "center",
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid rgba(231, 213, 186, 0.14)",
              color: "rgba(180, 190, 199, 0.8)",
              fontSize: 13,
              flexWrap: "wrap"
            }}
          >
            <span>Personal command center</span>
            <span>Autonomous where useful</span>
            <span>Built around your priorities</span>
          </div>
        </div>
      </div>

      <div
        className="auth-form-panel"
        style={{
          padding: "26px clamp(20px, 2.4vw, 36px)",
          background:
            "linear-gradient(180deg, rgba(17, 29, 44, 0.92), rgba(11, 20, 32, 0.94))",
          display: "grid",
          alignItems: "center"
        }}
      >
        <div
          className="auth-card"
          style={{
            border: "1px solid rgba(163, 181, 197, 0.28)",
            borderRadius: 28,
            background: "linear-gradient(180deg, rgba(18, 30, 45, 0.92), rgba(13, 23, 36, 0.95))",
            padding: "26px 26px 22px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 54px rgba(0, 0, 0, 0.22)"
          }}
        >
          <div
            className="auth-form-mark"
            style={{
              display: "grid",
              placeItems: "center",
              width: 46,
              height: 46,
              margin: "0 auto 14px",
              color: "var(--accent)",
              fontSize: 24
            }}
          >
            ◫
          </div>
          <div className="auth-form-header" style={{ textAlign: "center", marginBottom: 18 }}>
            <div
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.26em",
                fontSize: 13,
                color: "rgba(233, 237, 240, 0.92)"
              }}
            >
              Personal Agent Suite
            </div>
            <p className="auth-form-subtitle" style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 17, lineHeight: 1.35 }}>
              Your personal operating system for decisions, execution, and follow-through.
            </p>
          </div>

          <div
            className="auth-mode-tabs"
            role="tablist"
            aria-label="Authentication mode"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 0,
              padding: 5,
              borderRadius: 16,
              border: "1px solid rgba(163, 181, 197, 0.24)",
              background: "rgba(255,255,255,0.03)"
            }}
          >
            <ModeButton active={mode === "login"} onClick={() => switchMode("login")}>
              Sign in
            </ModeButton>
            <ModeButton active={mode === "register"} onClick={() => switchMode("register")}>
              Register
            </ModeButton>
          </div>

          {mode === "login" && loginError ? (
            <p
              role="alert"
              style={{
                marginTop: 14,
                marginBottom: 0,
                padding: "11px 13px",
                borderRadius: 16,
                background: "rgba(255, 118, 118, 0.1)",
                color: "#ffb5b5"
              }}
            >
              {loginError}
            </p>
          ) : null}

          {mode === "register" && registerError && Object.keys(registerErrors).length === 0 ? (
            <p
              role="alert"
              style={{
                marginTop: 14,
                marginBottom: 0,
                padding: "11px 13px",
                borderRadius: 16,
                background: "rgba(255, 118, 118, 0.1)",
                color: "#ffb5b5"
              }}
            >
              {registerError}
            </p>
          ) : null}

          {notice ? (
            <p
              style={{
                marginTop: 14,
                marginBottom: 0,
                padding: "11px 13px",
                borderRadius: 16,
                background: "rgba(103, 215, 160, 0.12)",
                color: "#cff6df"
              }}
            >
              {notice}
            </p>
          ) : null}

          {mode === "login" ? (
            <form className="auth-form-grid" onSubmit={handleLoginSubmit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
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

              <div
                className="auth-form-meta"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  color: "var(--muted)",
                  fontSize: 13,
                  flexWrap: "wrap"
                }}
              >
                <span>Remember this device</span>
                <span style={{ color: "var(--accent)" }}>Private deployment</span>
              </div>

              <SubmitButton pending={isPending}>Sign in to your suite</SubmitButton>

              <div
                className="auth-divider"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  gap: 14,
                  alignItems: "center",
                  marginTop: 6,
                  color: "var(--muted)",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em"
                }}
              >
                <span style={{ display: "block", height: 1, background: "rgba(163, 181, 197, 0.18)" }} />
                <span>or continue with</span>
                <span style={{ display: "block", height: 1, background: "rgba(163, 181, 197, 0.18)" }} />
              </div>

              <div
                className="auth-oauth-grid"
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr 1fr"
                }}
              >
                <OAuthButton label="Google" provider="google" />
                <OAuthButton label="GitHub" provider="github" />
              </div>
            </form>
          ) : (
            <form className="auth-form-grid" onSubmit={handleRegisterSubmit} style={{ display: "grid", gap: 14, marginTop: 18 }}>
              <div className="auth-register-pair" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                <Field>
                  <FieldLabel htmlFor="register-name">Full name</FieldLabel>
                  <FieldInput
                    id="register-name"
                    name="name"
                    autoComplete="name"
                    placeholder="Alex Operator"
                    value={registerState.name}
                    onChange={(event) => updateRegisterField("name", event.target.value)}
                    aria-invalid={registerErrors.name ? true : undefined}
                    required
                  />
                  <FieldMessage>{registerErrors.name}</FieldMessage>
                </Field>

                <Field>
                  <FieldLabel htmlFor="register-username">Username</FieldLabel>
                  <FieldInput
                    id="register-username"
                    name="username"
                    autoComplete="username"
                    placeholder="alex"
                    value={registerState.username}
                    onChange={(event) => updateRegisterField("username", event.target.value)}
                    aria-invalid={registerErrors.username ? true : undefined}
                    required
                  />
                  <FieldMessage>{registerErrors.username}</FieldMessage>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="register-email">Email</FieldLabel>
                <FieldInput
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="alex@example.com"
                  value={registerState.email}
                  onChange={(event) => updateRegisterField("email", event.target.value)}
                  aria-invalid={registerErrors.email ? true : undefined}
                  required
                />
                <FieldMessage>{registerErrors.email}</FieldMessage>
              </Field>

              <Field>
                <FieldLabel htmlFor="register-password">Password</FieldLabel>
                <FieldInput
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={registerState.password}
                  onChange={(event) => updateRegisterField("password", event.target.value)}
                  minLength={8}
                  aria-invalid={registerErrors.password ? true : undefined}
                  required
                />
                <FieldMessage>{registerErrors.password}</FieldMessage>
              </Field>

              <p className="auth-register-note" style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.45 }}>
                Create your account once, then use the suite as your daily operating layer.
              </p>

              <SubmitButton pending={isPending}>Create your suite account</SubmitButton>
            </form>
          )}

          <div
            className="auth-footer-panel"
            style={{
              display: "grid",
              gap: 8,
              marginTop: 18,
              paddingTop: 18,
              borderTop: "1px solid rgba(163, 181, 197, 0.16)"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                color: "rgba(202, 214, 222, 0.86)",
                fontSize: 13,
                flexWrap: "wrap"
              }}
            >
              <span>Private by default</span>
              <span style={{ color: "var(--accent)" }}>Designed for focused, high-leverage work</span>
            </div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.45 }}>
              A single environment for planning, execution, and review across the work and life systems that matter.
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  function switchMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setLoginError(null);
    setRegisterError(null);
    setRegisterErrors({});
    setNotice(null);
  }

  function updateRegisterField(field: RegisterField, value: string) {
    const nextState = { ...registerState, [field]: value };
    setRegisterState(nextState);
    setRegisterErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = validateRegisterState(nextState);
      return {
        ...current,
        [field]: nextErrors[field]
      };
    });
    setRegisterError(null);
  }
}

function Field({ children }: { children: ReactNode }) {
  return <label style={{ display: "grid", gap: 8 }}>{children}</label>;
}

function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }} id={`${htmlFor}-label`}>
      {children}
    </span>
  );
}

function FieldInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        borderRadius: 16,
        border: "1px solid rgba(163, 181, 197, 0.22)",
        background: "rgba(255, 255, 255, 0.02)",
        color: "rgba(245, 239, 232, 0.96)",
        padding: "13px 15px",
        fontSize: 15,
        outline: "none",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
      }}
    />
  );
}

function FieldMessage({ children }: { children?: ReactNode }) {
  if (!children) {
    return null;
  }

  return (
    <span style={{ color: "#ffb5b5", fontSize: 13, lineHeight: 1.35 }} role="alert">
      {children}
    </span>
  );
}

function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 8,
        border: 0,
        borderRadius: 16,
        padding: "14px 18px",
        fontSize: 15,
        fontWeight: 700,
        background: pending
          ? "linear-gradient(90deg, rgba(111, 200, 201, 0.55), rgba(78, 168, 173, 0.55))"
          : "linear-gradient(90deg, #4e9ea5 0%, #6fc8c9 100%)",
        color: "var(--ink)",
        cursor: pending ? "progress" : "pointer"
      }}
    >
      {pending ? "Working..." : children}
    </button>
  );
}

function ModeButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        border: 0,
        borderRadius: 14,
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 700,
        background: active ? "rgba(76, 130, 140, 0.34)" : "transparent",
        color: active ? "var(--text)" : "var(--muted)",
        cursor: "pointer"
      }}
    >
      {children}
    </button>
  );
}

function FeatureRow({ body, icon, title }: { body: string; icon: string; title: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr",
        gap: 14,
        alignItems: "start"
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          display: "grid",
          placeItems: "center",
          border: "1px solid rgba(163, 181, 197, 0.22)",
          background: "rgba(255,255,255,0.02)",
          color: "var(--accent)",
          fontSize: 22
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "rgba(244, 236, 223, 0.96)",
            fontSize: 12,
            marginBottom: 4
          }}
        >
          {title}
        </div>
        <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.52, fontSize: 15 }}>{body}</p>
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
      style={{
        borderRadius: 14,
        border: "1px solid rgba(163, 181, 197, 0.2)",
        background: "rgba(255,255,255,0.02)",
        color: "var(--text)",
        padding: "13px 14px",
        fontSize: 14,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        cursor: "pointer"
      }}
    >
      <span aria-hidden="true" style={{ display: "grid", placeItems: "center" }}>
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
      <path
        d="M6.28 13.73a5.98 5.98 0 0 1 0-3.46V7.63H2.87a10 10 0 0 0 0 8.74l3.41-2.64Z"
        fill="#FBBC05"
      />
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

function validateRegisterState(state: RegisterState): RegisterErrors {
  const errors: RegisterErrors = {};

  if (state.name.trim().length === 0) {
    errors.name = "Enter your full name.";
  }

  if (state.username.trim().length === 0) {
    errors.username = "Choose a username.";
  } else if (!/^[\w.@+-]+$/.test(state.username)) {
    errors.username = "Use letters, numbers, and . @ + - _.";
  }

  if (state.email.trim().length === 0) {
    errors.email = "Enter your email address.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (state.password.length === 0) {
    errors.password = "Create a password.";
  } else if (state.password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }

  return errors;
}
