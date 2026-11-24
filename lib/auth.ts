import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      // GitHub now returns `iss=https://github.com/login/oauth` (RFC 9207) on OAuth callbacks;
      // next-auth v4's openid-client requires `issuer` to be set when `iss` is present.
      issuer: "https://github.com/login/oauth",
    }),
  ],
  session: { strategy: "database" },

  // IMPORTANT: so we can access user.id later
  callbacks: {
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
};
