export type Comparable = { id: string; price: number; areaSqm: number };

export type Valuation =
  | { ok: false; reason: "missing_area" | "insufficient_comparables"; comparablesUsed: number }
  | {
      ok: true;
      comparablesUsed: number;
      comparableIds: string[];
      pricePerSqm: { low: number; median: number; high: number };
      estimate: { low: number; mid: number; high: number };
      confidence: "low" | "medium" | "high";
    };

/** Comparables further than this from the subject's size distort the price per m². */
const AREA_BAND = 0.35;
export const MIN_COMPARABLES = 3;

function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo]!;
  const b = sorted[hi]!;
  return a + (b - a) * (pos - lo);
}

/**
 * Comparable-sales estimate: median price per m² of similarly sized comparables,
 * with the interquartile range as the price band. The caller is responsible for
 * passing comparables of the same deal type, property type, city and currency.
 */
export function estimateValue(subjectAreaSqm: number | null | undefined, comparables: readonly Comparable[]): Valuation {
  if (!subjectAreaSqm || subjectAreaSqm <= 0) {
    return { ok: false, reason: "missing_area", comparablesUsed: 0 };
  }
  const used = comparables.filter(
    (c) =>
      c.price > 0 &&
      c.areaSqm > 0 &&
      c.areaSqm >= subjectAreaSqm * (1 - AREA_BAND) &&
      c.areaSqm <= subjectAreaSqm * (1 + AREA_BAND),
  );
  if (used.length < MIN_COMPARABLES) {
    return { ok: false, reason: "insufficient_comparables", comparablesUsed: used.length };
  }
  const perSqm = used.map((c) => c.price / c.areaSqm).sort((a, b) => a - b);
  const low = quantile(perSqm, 0.25);
  const median = quantile(perSqm, 0.5);
  const high = quantile(perSqm, 0.75);
  const spread = (high - low) / median;
  const confidence = used.length >= 8 && spread < 0.25 ? "high" : used.length >= 5 && spread < 0.4 ? "medium" : "low";
  const round = (n: number) => Math.round(n);
  return {
    ok: true,
    comparablesUsed: used.length,
    comparableIds: used.map((c) => c.id),
    pricePerSqm: { low: round(low), median: round(median), high: round(high) },
    estimate: {
      low: round(low * subjectAreaSqm),
      mid: round(median * subjectAreaSqm),
      high: round(high * subjectAreaSqm),
    },
    confidence,
  };
}
