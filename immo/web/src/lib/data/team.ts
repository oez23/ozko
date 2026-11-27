import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";

export async function listMembers(session: Session) {
  return db
    .select({ id: users.id, fullName: users.fullName, email: users.email, role: memberships.role, joinedAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, session.orgId))
    .orderBy(memberships.createdAt);
}

/** Users only ever edit their own profile; the id comes from the session, never from the request. */
export async function updateProfile(session: Session, input: { fullName: string; phone?: string }): Promise<void> {
  await db.update(users).set({ fullName: input.fullName, phone: input.phone ?? null }).where(eq(users.id, session.userId));
  await audit(session, "update", "profile", session.userId);
}
