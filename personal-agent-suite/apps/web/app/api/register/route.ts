import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import { NextResponse } from "next/server";
import { z } from "zod";


const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(150),
  password: z.string().min(8).max(200),
  username: z
    .string()
    .min(1)
    .max(150)
    .regex(/^[\w.@+-]+$/, "Username may only contain letters, digits, and @/./+/-/_")
});

type RegisterField = keyof z.infer<typeof registerSchema>;

type AuthentikUserResponse = {
  email?: string;
  name: string;
  pk: number;
  username: string;
};

/**
 * Creates a new Authentik-backed account for the suite's custom registration flow.
 *
 * @param request The incoming registration request with name, username, email, and password.
 * @returns A JSON payload describing the created account or structured validation errors.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(
      parsed.error.issues
        .map((issue) => [String(issue.path[0] ?? ""), issue.message] as const)
        .filter(([field]) => field.length > 0)
    ) as Partial<Record<RegisterField, string>>;

    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid registration payload.",
        fieldErrors
      },
      { status: 400 }
    );
  }

  const env = loadEnv();
  const urls = buildServiceUrls(env);

  const createResponse = await authentikFetch(`${urls.authentikBootstrapApiUrl}/core/users/`, {
    method: "POST",
    body: JSON.stringify({
      email: parsed.data.email,
      is_active: true,
      name: parsed.data.name,
      username: parsed.data.username
    }),
    headers: {
      Authorization: `Bearer ${env.AUTHENTIK_BOOTSTRAP_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!createResponse.ok) {
    return NextResponse.json(await extractAuthentikError(createResponse), { status: createResponse.status });
  }

  const createdUser = (await createResponse.json()) as AuthentikUserResponse;

  const passwordResponse = await authentikFetch(`${urls.authentikBootstrapApiUrl}/core/users/${createdUser.pk}/set_password/`, {
    method: "POST",
    body: JSON.stringify({
      password: parsed.data.password
    }),
    headers: {
      Authorization: `Bearer ${env.AUTHENTIK_BOOTSTRAP_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!passwordResponse.ok) {
    return NextResponse.json(await extractAuthentikError(passwordResponse), { status: passwordResponse.status });
  }

  return NextResponse.json({
    ok: true,
    user: {
      email: createdUser.email ?? parsed.data.email,
      name: createdUser.name,
      username: createdUser.username
    }
  });
}

async function authentikFetch(input: string, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    cache: "no-store"
  });
}

async function extractAuthentikError(response: Response) {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const fieldErrors = extractFieldErrors(parsed);
    return {
      error: flattenAuthentikError(parsed) ?? "Registration failed.",
      fieldErrors
    };
  } catch {
    return { error: text || "Registration failed." };
  }
}

function flattenAuthentikError(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = flattenAuthentikError(item);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) {
      const result = flattenAuthentikError(nested);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

function extractFieldErrors(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const fieldErrors: Partial<Record<RegisterField, string>> = {};
  for (const field of ["email", "name", "password", "username"] as const) {
    const result = flattenAuthentikError((value as Record<string, unknown>)[field]);
    if (result) {
      fieldErrors[field] = normalizeFieldError(field, result);
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function normalizeFieldError(field: RegisterField, message: string) {
  const lowered = message.toLowerCase();
  if ((field === "email" || field === "username") && lowered.includes("unique")) {
    return field === "email" ? "That email is already in use." : "That username is already taken.";
  }

  return message;
}
