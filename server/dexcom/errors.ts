// Typed Dexcom errors. Messages are fixed strings: never put a response body, token or code in one.
export class DexcomError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The refresh token is no longer valid (or there is no connection): the person must reconnect. */
export class ReconnectRequired extends DexcomError {
  constructor() {
    super("needs_reconnect", "Dexcom needs to be reconnected.");
  }
}

export class RateLimited extends DexcomError {
  constructor(public retryAfterSeconds: number) {
    super("rate_limited", "Dexcom rate limit reached; try again later.");
  }
}

export class Forbidden extends DexcomError {
  constructor() {
    super("forbidden", "Dexcom refused access to this data.");
  }
}

/** Network error, timeout, 5xx or an unreadable reply. */
export class Unavailable extends DexcomError {
  constructor() {
    super("unavailable", "Dexcom could not be reached.");
  }
}

/** Dexcom answered with a client error we cannot fix by retrying (for example 400 or 404). */
export class UpstreamRejected extends DexcomError {
  constructor() {
    super("upstream_rejected", "Dexcom rejected the request.");
  }
}

export class UnexpectedSchema extends DexcomError {
  constructor() {
    super(
      "unexpected_schema",
      "Dexcom sent data in a shape we do not understand.",
    );
  }
}
