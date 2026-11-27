import { notFound } from "next/navigation";
import { NotFoundError } from "./errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID.test(value);

/** Rejects malformed ids before they reach Postgres, where a bad uuid would raise a 500. */
export function uuidParam(value: string): string {
  if (!isUuid(value)) notFound();
  return value;
}

export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
