import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    role: "owner" | "service";
    preferredUsername?: string;
    user: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    preferred_username?: string;
    role?: "owner" | "service";
  }
}
