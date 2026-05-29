import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import { NextResponse } from "next/server";
import { z } from "zod";


const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

type FlowExecutorResponse = {
  component?: string;
  response_errors?: string[];
};

/**
 * Authenticates a user against Authentik's flow executor before handing off to Auth.js.
 *
 * @param request The incoming login request containing identifier and password.
 * @returns A JSON success payload with propagated Authentik cookies or a 4xx error response.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Identifier and password are required." }, { status: 400 });
  }

  try {
    const env = loadEnv();
    const urls = buildServiceUrls(env);
    const flowUrl = `${urls.authentikBootstrapApiUrl}/flows/executor/default-authentication-flow/`;
    const cookies = new CookieBridge();

    let currentState = await readFlowState(flowUrl, cookies);
    if (currentState.component === "xak-flow-redirect") {
      const response = NextResponse.json({ ok: true });
      cookies.applyTo(response);
      return response;
    }

    if (currentState.component === "ak-stage-identification") {
      currentState = await submitFlowStage(flowUrl, cookies, {
        component: "ak-stage-identification",
        uid_field: parsed.data.identifier
      });

      if (currentState.component === "xak-flow-redirect") {
        const response = NextResponse.json({ ok: true });
        cookies.applyTo(response);
        return response;
      }
    }

    if (currentState.component !== "ak-stage-password") {
      throw new Error(extractFlowError(currentState) ?? "Unexpected authentication state.");
    }

    currentState = await submitFlowStage(flowUrl, cookies, {
      component: "ak-stage-password",
      password: parsed.data.password
    });

    if (currentState.component === "xak-flow-redirect") {
      const response = NextResponse.json({ ok: true });
      cookies.applyTo(response);
      return response;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      currentState = await readFlowState(flowUrl, cookies);
      if (currentState.component === "xak-flow-redirect") {
        const response = NextResponse.json({ ok: true });
        cookies.applyTo(response);
        return response;
      }

      const flowError = extractFlowError(currentState);
      if (flowError) {
        throw new Error(flowError);
      }
    }

    throw new Error("Authentication did not complete.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed." },
      { status: 401 }
    );
  }
}

async function readFlowState(flowUrl: string, cookies: CookieBridge) {
  const response = await fetch(flowUrl, {
    cache: "no-store",
    headers: cookies.asRequestHeaders()
  });

  cookies.capture(response);

  if (!response.ok) {
    throw new Error("Authentication flow is unavailable.");
  }

  return (await response.json()) as FlowExecutorResponse;
}

async function submitFlowStage(flowUrl: string, cookies: CookieBridge, payload: Record<string, string>) {
  const headers = new Headers({
    "Content-Type": "application/json"
  });
  const cookieHeader = cookies.asCookieHeader();
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }
  const csrfToken = cookies.get("authentik_csrf");
  if (csrfToken) {
    headers.set("x-csrftoken", csrfToken);
  }
  headers.set("referer", flowUrl);

  const response = await fetch(flowUrl, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify(payload)
  });

  cookies.capture(response);

  const parsed = await parseMaybeJson(response);
  if (!response.ok) {
    throw new Error(extractFlowError(parsed) ?? "Authentication request failed.");
  }

  return parsed;
}

async function parseMaybeJson(response: Response): Promise<FlowExecutorResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  return (await response.json()) as FlowExecutorResponse;
}

function extractFlowError(response: FlowExecutorResponse) {
  if (Array.isArray(response.response_errors) && response.response_errors.length > 0) {
    return response.response_errors[0];
  }

  return null;
}

class CookieBridge {
  private readonly cookieMap = new Map<string, string>();
  private readonly outboundSetCookies: string[] = [];

  constructor(initialCookieHeader?: string | null) {
    if (!initialCookieHeader) {
      return;
    }

    for (const segment of initialCookieHeader.split(/;\s*/)) {
      const [name, ...rest] = segment.split("=");
      if (!name || rest.length === 0) {
        continue;
      }
      this.cookieMap.set(name, rest.join("="));
    }
  }

  asRequestHeaders() {
    const headers = new Headers();

    const cookieHeader = this.asCookieHeader();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    return headers;
  }

  asCookieHeader() {
    if (this.cookieMap.size === 0) {
      return "";
    }

    return Array.from(this.cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get(name: string) {
    return this.cookieMap.get(name);
  }

  capture(response: Response) {
    const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const setCookies = typeof getSetCookie === "function" ? getSetCookie.call(response.headers) : [];

    for (const headerValue of setCookies.length > 0 ? setCookies : fallbackSetCookies(response.headers.get("set-cookie"))) {
      const [pair] = headerValue.split(";", 1);
      const [name, ...rest] = pair.split("=");
      if (!name || rest.length === 0) {
        continue;
      }

      this.cookieMap.set(name, rest.join("="));
      this.outboundSetCookies.push(headerValue);
    }
  }

  applyTo(response: NextResponse) {
    for (const setCookie of this.outboundSetCookies) {
      response.headers.append("set-cookie", setCookie);
    }
  }
}

function fallbackSetCookies(value: string | null) {
  return value ? [value] : [];
}
