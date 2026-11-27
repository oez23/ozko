import type { MatchResult } from "@immo/core";
import { MATCH_REASON_LABELS } from "@/lib/labels";
import { Badge } from "./ui";

export function MatchSummary({ match }: { match: MatchResult }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={match.score >= 80 ? "brand" : "warn"}>{match.score} % Übereinstimmung</Badge>
      {match.reasons.map((reason) => <Badge key={reason}>{MATCH_REASON_LABELS[reason]}</Badge>)}
    </div>
  );
}
