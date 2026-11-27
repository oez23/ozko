import type { MatchResult } from "@immo/core";
import { fill, type Messages } from "@/i18n";
import { Badge } from "./ui";

export function MatchSummary({ match, m }: { match: MatchResult; m: Messages }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={match.score >= 80 ? "brand" : "warn"}>{fill(m.property.matchScore, { score: match.score })}</Badge>
      {match.reasons.map((reason) => <Badge key={reason}>{m.enums.matchReason[reason]}</Badge>)}
    </div>
  );
}
