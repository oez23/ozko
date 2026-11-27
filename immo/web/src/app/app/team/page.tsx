import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { fill } from "@/i18n";
import { getI18n } from "@/i18n/server";
import { requireSession } from "@/lib/auth";
import { listMembers } from "@/lib/data/team";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).m.team.title };
}

export default async function TeamPage() {
  const session = await requireSession();
  const { m, f } = await getI18n();
  const members = await listMembers(session);
  return (
    <>
      <PageHeader title={m.team.title} subtitle={session.orgName} />
      <Card>
        <ul className="divide-y divide-line">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{member.fullName}</p>
                <p className="text-xs text-muted">{member.email} · {fill(m.team.since, { date: f.date(member.joinedAt) })}</p>
              </div>
              <Badge tone={member.role === "agent" ? "neutral" : "brand"}>{m.enums.role[member.role]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
