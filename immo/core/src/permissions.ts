import type { Role } from "./domain";

export type Actor = { userId: string; role: Role };

const isManager = (role: Role) => role === "owner" || role === "admin";

/** Properties are office memory: everyone in the office reads them, only the responsible agent or a manager changes them. */
export function canEditProperty(actor: Actor, agentId: string): boolean {
  return isManager(actor.role) || actor.userId === agentId;
}

/** Contacts are personal customer data: agents only see their own, managers see all. */
export function canAccessContact(actor: Actor, agentId: string): boolean {
  return isManager(actor.role) || actor.userId === agentId;
}

export function canSeeAllContacts(actor: Actor): boolean {
  return isManager(actor.role);
}

export function canManageTeam(actor: Actor): boolean {
  return isManager(actor.role);
}
