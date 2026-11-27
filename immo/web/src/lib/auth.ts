import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Role } from "@immo/core";
import { db } from "@/db/client";
import { loginAttempts, memberships, organizations, sessions, users } from "@/db/schema";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "immo_session";
const SESSION_DAYS = 30;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export type Session = {
  userId: string;
  orgId: string;
  role: Role;
  fullName: string;
  email: string;
  orgName: string;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Hash compared against when the e-mail is unknown, so response time does not reveal which accounts exist. */
const DUMMY_HASH = hashPassword(randomBytes(16).toString("hex"));

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, orgId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, orgId, expiresAt });
  return { token, expiresAt };
}

/** Resolves a raw token (cookie or mobile bearer token). The role is re-read on every request, so removing a member takes effect at once. */
export async function resolveSessionToken(token: string): Promise<Session | null> {
  const [row] = await db
    .select({
      userId: users.id,
      orgId: organizations.id,
      role: memberships.role,
      fullName: users.fullName,
      email: users.email,
      orgName: organizations.name,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizations, eq(organizations.id, sessions.orgId))
    .innerJoin(memberships, and(eq(memberships.userId, sessions.userId), eq(memberships.orgId, sessions.orgId)))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? resolveSessionToken(token) : null;
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

export type LoginResult =
  | { ok: true; userId: string; orgId: string }
  | { ok: false; reason: "invalid" | "locked" };

/** Throttled per e-mail (not per IP: the client IP header is only trustworthy behind a known proxy). */
export async function authenticate(email: string, password: string): Promise<LoginResult> {
  const key = `login:${email}`;
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);
  const [attempts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.key, key), gt(loginAttempts.createdAt, since)));
  if ((attempts?.count ?? 0) >= MAX_FAILED_LOGINS) return { ok: false, reason: "locked" };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
  const [membership] = user
    ? await db.select().from(memberships).where(eq(memberships.userId, user.id)).orderBy(memberships.createdAt).limit(1)
    : [];
  if (!user || !valid || !membership) {
    await db.insert(loginAttempts).values({ key });
    return { ok: false, reason: "invalid" };
  }
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { ok: true, userId: user.id, orgId: membership.orgId };
}
