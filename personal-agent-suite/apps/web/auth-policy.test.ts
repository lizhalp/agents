import { loadEnv } from "@agent-suite/config";
import { describe, expect, it } from "vitest";

import { isConfiguredOwner, isOwnerPrincipal, pickPreferredUsername } from "./auth-policy.js";

const env = loadEnv({
  AUTH_LOCAL_EMAIL: "owner@example.com",
  AUTH_LOCAL_PASSWORD: "correct-password",
  AUTH_LOCAL_USERNAME: "owner",
  AUTH_OWNER_EMAILS: "secondary@example.com",
  AUTH_OWNER_USERNAMES: "github-owner"
});

describe("isConfiguredOwner", () => {
  it("allows the configured local owner by username or email", () => {
    expect(isConfiguredOwner(env, "owner", "correct-password")).toBe(true);
    expect(isConfiguredOwner(env, " OWNER@EXAMPLE.COM ", "correct-password")).toBe(true);
  });

  it("rejects unknown identifiers and wrong passwords", () => {
    expect(isConfiguredOwner(env, "owner", "wrong-password")).toBe(false);
    expect(isConfiguredOwner(env, "someone@example.com", "correct-password")).toBe(false);
  });
});

describe("isOwnerPrincipal", () => {
  it("allows the local owner and additional owner allowlist entries", () => {
    expect(isOwnerPrincipal(env, { email: "owner@example.com" })).toBe(true);
    expect(isOwnerPrincipal(env, { email: "secondary@example.com" })).toBe(true);
    expect(isOwnerPrincipal(env, { preferred_username: "github-owner" })).toBe(true);
  });

  it("rejects OAuth identities outside the owner allowlist", () => {
    expect(isOwnerPrincipal(env, { email: "guest@example.com" })).toBe(false);
    expect(isOwnerPrincipal(env, { preferred_username: "guest" })).toBe(false);
    expect(isOwnerPrincipal(env, {})).toBe(false);
  });
});

describe("pickPreferredUsername", () => {
  it("uses standard preferred_username before provider-specific login", () => {
    expect(pickPreferredUsername({ preferred_username: "standard", login: "github" }, undefined)).toBe("standard");
  });

  it("falls back to GitHub login and then the existing token value", () => {
    expect(pickPreferredUsername({ login: "github" }, undefined)).toBe("github");
    expect(pickPreferredUsername({}, "existing")).toBe("existing");
  });
});
