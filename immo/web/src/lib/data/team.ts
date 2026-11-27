import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, users } from "@/db/schema";
import type { Session } from "@/lib/auth";

export async function listMembers(session: Session) {
  return db
    .select({ id: users.id, fullName: users.fullName, email: users.email, role: memberships.role, joinedAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, session.orgId))
    .orderBy(memberships.createdAt);
}
