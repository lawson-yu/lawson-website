import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { isSiteOwner } from "@/lib/auth-policy";
import { getPrisma } from "./db";
import { recordVisitorLogin, VISITOR_RECORDS_CACHE_TAG } from "./visitors";

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export function isAuthConfigured() {
  return (
    hasValue(process.env.DATABASE_URL) &&
    hasValue(process.env.BETTER_AUTH_URL) &&
    hasValue(process.env.BETTER_AUTH_SECRET) &&
    hasValue(process.env.GOOGLE_CLIENT_ID) &&
    hasValue(process.env.GOOGLE_CLIENT_SECRET)
  );
}

function createAuth() {
  return betterAuth({
    appName: "Lawson Website",
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(getPrisma(), { provider: "postgresql" }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await recordVisitorLogin(session.userId, session.createdAt);
            revalidateTag(VISITOR_RECORDS_CACHE_TAG, { expire: 0 });
          },
        },
      },
    },
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
let auth: AuthInstance | undefined;

export function getAuth() {
  if (!isAuthConfigured()) return null;
  if (auth) return auth;
  auth = createAuth();

  return auth;
}

export async function getCurrentSession() {
  const requestHeaders = await headers();
  const configuredAuth = getAuth();
  if (!configuredAuth) return null;
  return configuredAuth.api.getSession({ headers: requestHeaders });
}

export async function requireSiteOwner() {
  const session = await getCurrentSession();
  if (!session) redirect("/zh?next=%2Fadmin");
  if (!isSiteOwner(session.user.email, session.user.emailVerified)) notFound();
  return session;
}
