import { buildServiceUrls, loadEnv } from "@agent-suite/config";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import type { JWT } from "next-auth/jwt";


const env = loadEnv();
const urls = buildServiceUrls(env);

/**
 * Determines whether the authenticated identity should receive owner privileges.
 *
 * @param token The JWT token assembled by Auth.js callbacks.
 * @returns `true` when the token matches an allowlisted owner email or username.
 */
function isOwnerToken(token: JWT) {
  const username = normalizePrincipal(
    typeof token.preferred_username === "string"
      ? token.preferred_username
      : typeof token.login === "string"
        ? token.login
        : undefined
  );
  const email = normalizePrincipal(typeof token.email === "string" ? token.email : undefined);
  const ownerEmails = new Set(
    env.AUTH_OWNER_EMAILS.split(",")
      .map((value) => normalizePrincipal(value))
      .filter(Boolean)
  );
  const ownerUsernames = new Set(
    env.AUTH_OWNER_USERNAMES.split(",")
      .map((value) => normalizePrincipal(value))
      .filter(Boolean)
  );

  if (email) {
    ownerEmails.add(normalizePrincipal(env.AUTHENTIK_BOOTSTRAP_EMAIL));
  }

  if (username) {
    ownerUsernames.add("akadmin");
  }

  return (email && ownerEmails.has(email)) || (username && ownerUsernames.has(username)) || false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin"
  },
  providers: [
    ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_ID,
            clientSecret: env.AUTH_GOOGLE_SECRET
          })
        ]
      : []),
    ...(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET
      ? [
          GitHub({
            clientId: env.AUTH_GITHUB_ID,
            clientSecret: env.AUTH_GITHUB_SECRET
          })
        ]
      : []),
    {
      id: "authentik",
      name: "Authentik",
      type: "oidc",
      clientId: env.AUTHENTIK_CLIENT_ID,
      clientSecret: env.AUTHENTIK_CLIENT_SECRET,
      issuer: urls.authentikIssuer,
      wellKnown: urls.authentikDiscoveryUrl,
      authorization: {
        url: urls.authentikAuthorizeUrl,
        params: {
          scope: "openid email profile"
        }
      },
      client: {
        id_token_signed_response_alg: "HS256"
      },
      token: urls.authentikTokenUrl,
      userinfo: urls.authentikUserInfoUrl,
      checks: ["pkce", "state"]
    }
  ],
  callbacks: {
    async jwt({ token, profile, account }) {
      if (profile && typeof profile === "object") {
        const preferredUsername =
          "preferred_username" in profile && typeof profile.preferred_username === "string"
            ? profile.preferred_username
            : "login" in profile && typeof profile.login === "string"
              ? profile.login
            : token.preferred_username;

        token.preferred_username = preferredUsername;
        token.email = typeof profile.email === "string" ? profile.email : token.email;
        token.name = typeof profile.name === "string" ? profile.name : token.name;

        if ("login" in profile && typeof profile.login === "string") {
          token.login = profile.login;
        }
      }

      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      token.role = isOwnerToken(token) ? "owner" : "service";
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        email: typeof token.email === "string" ? token.email : session.user?.email,
        name: typeof token.name === "string" ? token.name : session.user?.name
      };
      session.role = token.role === "owner" ? "owner" : "service";
      session.preferredUsername = typeof token.preferred_username === "string" ? token.preferred_username : undefined;
      return session;
    }
  }
});

/**
 * Normalizes identity strings before role and ownership comparisons.
 *
 * @param value The raw username or email value from a token or environment variable.
 * @returns A trimmed, lowercase identifier or an empty string when absent.
 */
function normalizePrincipal(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}
