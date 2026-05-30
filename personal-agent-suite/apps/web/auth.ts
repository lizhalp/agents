import "server-only";

import { loadEnv } from "@agent-suite/config";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { isConfiguredOwner, isOwnerPrincipal, pickPreferredUsername } from "./auth-policy";

import type { User } from "next-auth";

const env = loadEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin"
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Password",
      credentials: {
        identifier: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      authorize(credentials) {
        const identifier = typeof credentials.identifier === "string" ? credentials.identifier : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";

        if (!isConfiguredOwner(env, identifier, password)) {
          return null;
        }

        return {
          id: "local-owner",
          email: env.AUTH_LOCAL_EMAIL,
          name: env.AUTH_LOCAL_NAME,
          preferredUsername: env.AUTH_LOCAL_USERNAME,
          role: "owner"
        } satisfies User;
      }
    }),
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
      : [])
  ],
  callbacks: {
    async signIn({ account, profile, user }) {
      if (account?.provider === "credentials") {
        return user.role === "owner";
      }

      return isOwnerPrincipal(env, {
        email: typeof profile?.email === "string" ? profile.email : user.email,
        preferred_username: pickPreferredUsername(profile ?? {}, undefined)
      });
    },
    async jwt({ token, profile, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.preferred_username = user.preferredUsername;
        token.role = user.role;
      }

      if (profile && typeof profile === "object") {
        token.email = typeof profile.email === "string" ? profile.email : token.email;
        token.name = typeof profile.name === "string" ? profile.name : token.name;
        token.preferred_username = pickPreferredUsername(profile, token.preferred_username);
        token.role = isOwnerPrincipal(env, token) ? "owner" : "service";
      }

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
