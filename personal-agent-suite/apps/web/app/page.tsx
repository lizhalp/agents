import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import { statusResponseSchema, type StatusResponse } from "@agent-suite/shared-types";

export const dynamic = "force-dynamic";

async function getStatus(): Promise<StatusResponse | null> {
  const env = loadEnv();
  const urls = buildServiceUrls(env);

  try {
    const response = await fetch(`${urls.apiBaseUrl}/api/status`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    return statusResponseSchema.parse(json);
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const status = await getStatus();

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 24px",
        display: "grid",
        placeItems: "center"
      }}
    >
      <section
        style={{
          width: "min(920px, 100%)",
          padding: 32,
          border: "1px solid var(--panel-border)",
          borderRadius: 24,
          background: "rgba(22, 27, 34, 0.86)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)"
        }}
      >
        <p style={{ margin: 0, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12 }}>
          Infrastructure Bring-Up
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: "clamp(2rem, 6vw, 4rem)" }}>Personal Agent Suite</h1>
        <p style={{ maxWidth: 720, color: "var(--muted)", fontSize: 18, lineHeight: 1.6 }}>
          Hello world for the self-hosted control plane. This page confirms the frontend, API, reverse proxy, and core runtime
          dependencies are wired together.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 16,
            marginTop: 32
          }}
        >
          {(status?.dependencies ?? [
            { name: "api", ok: false, message: "unreachable", latencyMs: null },
            { name: "postgres", ok: false, message: "unknown", latencyMs: null },
            { name: "redis", ok: false, message: "unknown", latencyMs: null },
            { name: "temporal", ok: false, message: "unknown", latencyMs: null },
            { name: "minio", ok: false, message: "unknown", latencyMs: null }
          ]).map((dependency) => (
            <article
              key={dependency.name}
              style={{
                padding: 16,
                borderRadius: 18,
                border: "1px solid var(--panel-border)",
                background: "rgba(13, 17, 23, 0.86)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 15, textTransform: "capitalize" }}>{dependency.name}</strong>
                <span
                  style={{
                    display: "inline-block",
                    minWidth: 10,
                    minHeight: 10,
                    borderRadius: 999,
                    background: dependency.ok ? "var(--ok)" : "var(--bad)"
                  }}
                />
              </div>
              <p style={{ color: "var(--muted)", marginBottom: 4 }}>{dependency.message}</p>
              <small style={{ color: "var(--muted)" }}>
                {dependency.latencyMs === null ? "n/a" : `${dependency.latencyMs} ms`}
              </small>
            </article>
          ))}
        </div>

        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid var(--panel-border)",
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            color: "var(--muted)"
          }}
        >
          <span>Environment: {status?.environment ?? "unavailable"}</span>
          <span>Overall: {status?.overallOk ? "healthy" : "degraded"}</span>
          <span>Updated: {status?.timestamp ?? "n/a"}</span>
        </div>
      </section>
    </main>
  );
}
