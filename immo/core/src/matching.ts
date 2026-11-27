import { placeKey, type Currency, type DealType, type PropertyStatus, type PropertyType } from "./domain";

export type MatchProperty = {
  dealType: DealType;
  propertyType: PropertyType;
  status: PropertyStatus;
  price: number;
  currency: Currency;
  city: string;
  district?: string | null;
  areaSqm?: number | null;
  rooms?: number | null;
};

export type MatchRequest = {
  dealType: DealType;
  propertyTypes: readonly PropertyType[];
  city: string;
  districts: readonly string[];
  currency: Currency;
  minPrice?: number | null;
  maxPrice?: number | null;
  minAreaSqm?: number | null;
  maxAreaSqm?: number | null;
  minRooms?: number | null;
};

export type MatchReason =
  | "price_in_budget"
  | "price_below_budget"
  | "price_slightly_over"
  | "district_match"
  | "district_other"
  | "area_fits"
  | "area_close"
  | "area_off"
  | "rooms_fit"
  | "rooms_one_short"
  | "rooms_short";

export type MatchResult = { score: number; reasons: MatchReason[] };

/** A buyer rarely walks away over a few percent; beyond this the listing is not worth showing. */
export const PRICE_TOLERANCE = 0.1;
const AREA_TOLERANCE = 0.15;
export const MATCH_THRESHOLD = 50;

const WEIGHTS = { price: 40, district: 25, area: 20, rooms: 15 } as const;

/**
 * Scores how well a property fits a buyer request (0–100), or null when a hard
 * criterion fails. Currencies are never converted: a mismatch is a non-match.
 */
export function scoreMatch(property: MatchProperty, request: MatchRequest): MatchResult | null {
  if (property.status !== "active") return null;
  if (property.dealType !== request.dealType) return null;
  if (!request.propertyTypes.includes(property.propertyType)) return null;
  if (property.currency !== request.currency) return null;
  if (placeKey(property.city) !== placeKey(request.city)) return null;

  const reasons: MatchReason[] = [];
  let score = 0;

  const { minPrice, maxPrice } = request;
  if (maxPrice != null && property.price > maxPrice) {
    const over = (property.price - maxPrice) / maxPrice;
    if (over > PRICE_TOLERANCE) return null;
    score += WEIGHTS.price * 0.5 * (1 - over / PRICE_TOLERANCE);
    reasons.push("price_slightly_over");
  } else if (minPrice != null && property.price < minPrice) {
    score += WEIGHTS.price * 0.75;
    reasons.push("price_below_budget");
  } else {
    score += WEIGHTS.price;
    reasons.push("price_in_budget");
  }

  if (request.districts.length === 0) {
    score += WEIGHTS.district;
  } else if (property.district && request.districts.some((d) => placeKey(d) === placeKey(property.district!))) {
    score += WEIGHTS.district;
    reasons.push("district_match");
  } else {
    reasons.push("district_other");
  }

  const { minAreaSqm, maxAreaSqm } = request;
  if (minAreaSqm == null && maxAreaSqm == null) {
    score += WEIGHTS.area;
  } else if (property.areaSqm == null) {
    score += WEIGHTS.area / 2;
  } else {
    const lo = minAreaSqm ?? 0;
    const hi = maxAreaSqm ?? Number.POSITIVE_INFINITY;
    if (property.areaSqm >= lo && property.areaSqm <= hi) {
      score += WEIGHTS.area;
      reasons.push("area_fits");
    } else if (property.areaSqm >= lo * (1 - AREA_TOLERANCE) && property.areaSqm <= hi * (1 + AREA_TOLERANCE)) {
      score += WEIGHTS.area / 2;
      reasons.push("area_close");
    } else {
      reasons.push("area_off");
    }
  }

  if (request.minRooms == null) {
    score += WEIGHTS.rooms;
  } else if (property.rooms == null) {
    score += WEIGHTS.rooms / 2;
  } else if (property.rooms >= request.minRooms) {
    score += WEIGHTS.rooms;
    reasons.push("rooms_fit");
  } else if (property.rooms >= request.minRooms - 1) {
    score += WEIGHTS.rooms / 3;
    reasons.push("rooms_one_short");
  } else {
    reasons.push("rooms_short");
  }

  return { score: Math.round(score), reasons };
}

export function rankMatches<T>(
  candidates: readonly T[],
  score: (candidate: T) => MatchResult | null,
  threshold = MATCH_THRESHOLD,
): Array<{ item: T; match: MatchResult }> {
  const out: Array<{ item: T; match: MatchResult }> = [];
  for (const item of candidates) {
    const match = score(item);
    if (match && match.score >= threshold) out.push({ item, match });
  }
  return out.sort((a, b) => b.match.score - a.match.score);
}
