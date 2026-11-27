/** Thrown by the data layer; callers map these to 403/404 responses instead of leaking details. */
export class ForbiddenError extends Error {
  constructor() {
    super("forbidden");
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("not_found");
  }
}
