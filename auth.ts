import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { supabaseAdmin } from "@/lib/supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account && user) {
        // プロバイダー固有のIDを生成（一貫性のあるID）
        const userId = `${account.provider}-${account.providerAccountId}`;
        user.id = userId;

        // ユーザー情報を Supabase に upsert
        await supabaseAdmin.from("users").upsert({
          id: userId,
          name: user.name || "",
          email: user.email || "",
          image: user.image || "",
          provider: account.provider,
          provider_account_id: account.providerAccountId,
          last_login: Date.now(),
        });
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user && account) {
        // プロバイダー固有の一貫したIDを使用
        token.sub = `${account.provider}-${account.providerAccountId}`;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  debug: process.env.NODE_ENV === "development",
});
