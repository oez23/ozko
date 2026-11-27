import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { listMembers } from "@/lib/data/team";
import { formatDate, ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requireSession();
  const members = await listMembers(session);
  return (
    <>
      <PageHeader title="Team" subtitle={session.orgName} />
      <Card>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{m.fullName}</p>
                <p className="text-xs text-muted">{m.email} · seit {formatDate(m.joinedAt)}</p>
              </div>
              <Badge tone={m.role === "agent" ? "neutral" : "brand"}>{ROLE_LABELS[m.role]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
