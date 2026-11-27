import "server-only";
import { db, type Tx } from "@/db/client";
import { auditLog } from "@/db/schema";
import type { Session } from "./auth";

export async function audit(
  session: Pick<Session, "orgId" | "userId">,
  action: string,
  entity: string,
  entityId: string | null,
  detail?: Record<string, unknown>,
  tx: Tx | typeof db = db,
): Promise<void> {
  await tx.insert(auditLog).values({ orgId: session.orgId, userId: session.userId, action, entity, entityId, detail });
}
