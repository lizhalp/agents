import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    role: "owner" | "service";
    preferredUsername?: string;
    user: DefaultSession["user"];
  }

  interface User {
    preferredUsername?: string;
    role?: "owner" | "service";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    email?: string;
    login?: string;
    preferred_username?: string;
    role?: "owner" | "service";
  }
}
