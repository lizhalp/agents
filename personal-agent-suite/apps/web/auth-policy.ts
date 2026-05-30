import type { RuntimeEnv } from "@agent-suite/config";

export type AuthPrincipal = {
  email?: unknown;
  preferred_username?: unknown;
};

/**
 * Checks whether credentials match the configured local owner account.
 *
 * @param env The validated runtime environment.
 * @param identifier The submitted email or username.
 * @param password The submitted password.
 * @returns True when the submitted credentials match the local owner.
 */
export function isConfiguredOwner(env: RuntimeEnv, identifier: string, password: string) {
  const normalizedIdentifier = normalizePrincipal(identifier);
  const acceptedIdentifiers = new Set([
    normalizePrincipal(env.AUTH_LOCAL_EMAIL),
    normalizePrincipal(env.AUTH_LOCAL_USERNAME)
  ]);

  return acceptedIdentifiers.has(normalizedIdentifier) && password === env.AUTH_LOCAL_PASSWORD;
}

/**
 * Checks whether an OAuth profile should be allowed into this personal deployment.
 *
 * @param env The validated runtime environment.
 * @param principal The normalized identity fields from an OAuth provider.
 * @returns True when the profile matches an owner email or username.
 */
export function isOwnerPrincipal(env: RuntimeEnv, principal: AuthPrincipal) {
  const email = typeof principal.email === "string" ? normalizePrincipal(principal.email) : "";
  const username =
    typeof principal.preferred_username === "string" ? normalizePrincipal(principal.preferred_username) : "";
  const ownerEmails = [env.AUTH_LOCAL_EMAIL, ...env.AUTH_OWNER_EMAILS.split(",")]
    .map((value) => normalizePrincipal(value))
    .filter(Boolean);
  const ownerUsernames = [env.AUTH_LOCAL_USERNAME, ...env.AUTH_OWNER_USERNAMES.split(",")]
    .map((value) => normalizePrincipal(value))
    .filter(Boolean);

  return (
    (email.length > 0 && ownerEmails.includes(email)) ||
    (username.length > 0 && ownerUsernames.includes(username))
  );
}

/**
 * Picks a stable username claim across OAuth providers.
 *
 * @param profile The provider profile payload.
 * @param fallback Existing username from the token, when present.
 * @returns A username-like provider claim, or the fallback.
 */
export function pickPreferredUsername(profile: Record<string, unknown>, fallback: unknown) {
  if (typeof profile.preferred_username === "string") {
    return profile.preferred_username;
  }

  if (typeof profile.login === "string") {
    return profile.login;
  }

  return typeof fallback === "string" ? fallback : undefined;
}

function normalizePrincipal(value: string) {
  return value.trim().toLowerCase();
}
