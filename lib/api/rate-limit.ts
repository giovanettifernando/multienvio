import { ApiError } from "@/lib/api/errors";

const RATE_LIMIT_SYMBOL = Symbol.for("envio.rateLimit.store");

type RateLimitStore = Map<string, number[]>;

function getStore(): RateLimitStore {
  const globalObj = globalThis as typeof globalThis & {
    [RATE_LIMIT_SYMBOL]?: RateLimitStore;
  };

  if (!globalObj[RATE_LIMIT_SYMBOL]) {
    globalObj[RATE_LIMIT_SYMBOL] = new Map();
  }

  return globalObj[RATE_LIMIT_SYMBOL]!;
}

type EnforceRateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export function enforceRateLimit({ key, limit, windowMs, now = Date.now() }: EnforceRateLimitInput) {
  const store = getStore();
  const timestamps = store.get(key) ?? [];
  const windowStart = now - windowMs;
  const recent = timestamps.filter((timestamp) => timestamp >= windowStart);

  recent.push(now);
  store.set(key, recent);

  if (recent.length > limit) {
    throw new ApiError({
      code: "rate_limit_exceeded",
      message: "Limite de requisições excedido. Tente novamente em instantes.",
      status: 429,
      details: { key, limit, windowMs },
    });
  }
}
