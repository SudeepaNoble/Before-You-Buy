import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

export const DAILY_RECOMMENDATION_LIMIT = 2;
export const DAILY_LIMIT_ERROR = "DAILY_LIMIT_REACHED";
export const DAILY_LIMIT_TITLE = "You’ve used your 2 checks for today.";
export const DAILY_LIMIT_MESSAGE =
  "You’ve used your 2 checks for today. Come back tomorrow before your next checkout.";
export const DAILY_LIMIT_SUPPORTING_TEXT =
  "Come back tomorrow before your next checkout.";
export const TEMPORARY_CHECKS_UNAVAILABLE_MESSAGE =
  "Checks are temporarily unavailable. Please try again a little later.";

type RedisScriptClient = Pick<Redis, "eval">;

export type DailyUsage = {
  limit: number;
  remaining: number;
  resetAt: string;
};

export type DailyLimitReservation = {
  completedKey: string;
  pendingKey: string;
  resetAt: Date;
};

type DailyLimitStoreKeys = {
  completedKey: string;
  pendingKey: string;
};

type DailyLimitStoreTiming = {
  limit: number;
  resetAtEpochSeconds: number;
};

export type DailyLimitStore = {
  reserve(
    keys: DailyLimitStoreKeys,
    timing: DailyLimitStoreTiming,
  ): Promise<{ allowed: boolean; remaining: number }>;
  complete(
    keys: DailyLimitStoreKeys,
    timing: DailyLimitStoreTiming,
  ): Promise<{ remaining: number }>;
  release(
    keys: DailyLimitStoreKeys,
    timing: DailyLimitStoreTiming,
  ): Promise<void>;
};

export class DailyLimitConfigurationError extends Error {
  constructor(message = "Daily recommendation limit is not configured") {
    super(message);
    this.name = "DailyLimitConfigurationError";
  }
}

export class DailyLimitStoreError extends Error {
  constructor(message = "Daily recommendation limit store is unavailable") {
    super(message);
    this.name = "DailyLimitStoreError";
  }
}

export class DailyLimitReachedError extends Error {
  usage: DailyUsage;

  constructor(usage: DailyUsage) {
    super(DAILY_LIMIT_MESSAGE);
    this.name = "DailyLimitReachedError";
    this.usage = usage;
  }
}

const RESERVE_SCRIPT = `
local completed = tonumber(redis.call("GET", KEYS[1]) or "0")
local pending = tonumber(redis.call("GET", KEYS[2]) or "0")
local limit = tonumber(ARGV[1])
local resetAt = tonumber(ARGV[2])

if completed >= limit then
  return {0, 0}
end

if (completed + pending) >= limit then
  return {0, 0}
end

pending = redis.call("INCR", KEYS[2])
redis.call("EXPIREAT", KEYS[1], resetAt)
redis.call("EXPIREAT", KEYS[2], resetAt)

local remaining = limit - completed - pending
if remaining < 0 then
  remaining = 0
end

return {1, remaining}
`;

const COMPLETE_SCRIPT = `
local pending = tonumber(redis.call("GET", KEYS[2]) or "0")
local limit = tonumber(ARGV[1])
local resetAt = tonumber(ARGV[2])

if pending > 0 then
  pending = redis.call("DECR", KEYS[2])
end

if pending <= 0 then
  redis.call("DEL", KEYS[2])
else
  redis.call("EXPIREAT", KEYS[2], resetAt)
end

local completed = redis.call("INCR", KEYS[1])
redis.call("EXPIREAT", KEYS[1], resetAt)

local remaining = limit - completed
if remaining < 0 then
  remaining = 0
end

return {remaining}
`;

const RELEASE_SCRIPT = `
local pending = tonumber(redis.call("GET", KEYS[2]) or "0")
local resetAt = tonumber(ARGV[2])

if pending > 0 then
  pending = redis.call("DECR", KEYS[2])
end

if pending <= 0 then
  redis.call("DEL", KEYS[2])
else
  redis.call("EXPIREAT", KEYS[2], resetAt)
end

return {1}
`;

export class RedisDailyLimitStore implements DailyLimitStore {
  constructor(private readonly redis: RedisScriptClient) {}

  async reserve(keys: DailyLimitStoreKeys, timing: DailyLimitStoreTiming) {
    const result = await this.runScript(RESERVE_SCRIPT, keys, timing, 2);
    return { allowed: result[0] === 1, remaining: result[1] ?? 0 };
  }

  async complete(keys: DailyLimitStoreKeys, timing: DailyLimitStoreTiming) {
    const result = await this.runScript(COMPLETE_SCRIPT, keys, timing, 1);
    return { remaining: result[0] ?? 0 };
  }

  async release(keys: DailyLimitStoreKeys, timing: DailyLimitStoreTiming) {
    await this.runScript(RELEASE_SCRIPT, keys, timing, 1);
  }

  private async runScript(
    script: string,
    keys: DailyLimitStoreKeys,
    timing: DailyLimitStoreTiming,
    expectedValues: number,
  ) {
    try {
      const result = await this.redis.eval(script, [keys.completedKey, keys.pendingKey], [
        String(timing.limit),
        String(timing.resetAtEpochSeconds),
      ]);

      return parseRedisNumberArray(result, expectedValues);
    } catch {
      throw new DailyLimitStoreError();
    }
  }
}

export class DailyRecommendationLimiter {
  constructor(
    private readonly store: DailyLimitStore,
    private readonly salt: string,
    private readonly now = () => new Date(),
  ) {}

  async reserve(clientIp: string) {
    const now = this.now();
    const resetAt = getNextUtcMidnight(now);
    const keys = createDailyLimitKeys(hashClientIp(clientIp, this.salt), now);
    const timing = {
      limit: DAILY_RECOMMENDATION_LIMIT,
      resetAtEpochSeconds: Math.floor(resetAt.getTime() / 1000),
    };

    const reservation = {
      ...keys,
      resetAt,
    };

    const result = await this.store.reserve(keys, timing);
    const usage = createUsage(result.remaining, resetAt);

    if (!result.allowed) {
      throw new DailyLimitReachedError(usage);
    }

    return {
      reservation,
      usage,
    };
  }

  async complete(reservation: DailyLimitReservation) {
    const timing = timingFromReservation(reservation);
    const result = await this.store.complete(reservation, timing);
    return createUsage(result.remaining, reservation.resetAt);
  }

  async release(reservation: DailyLimitReservation) {
    await this.store.release(reservation, timingFromReservation(reservation));
  }
}

let cachedLimiter: DailyRecommendationLimiter | null = null;

export function getDailyRecommendationLimiter() {
  if (cachedLimiter) return cachedLimiter;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const salt = process.env.RATE_LIMIT_SALT;

  if (!redisUrl || !redisToken || !salt) {
    throw new DailyLimitConfigurationError();
  }

  cachedLimiter = new DailyRecommendationLimiter(
    new RedisDailyLimitStore(Redis.fromEnv()),
    salt,
  );

  return cachedLimiter;
}

export function getNextUtcMidnight(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
}

export function getUtcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function hashClientIp(ip: string, salt: string) {
  return createHash("sha256").update(salt).update(":").update(ip).digest("hex");
}

export function createDailyLimitKeys(hashedIp: string, date: Date) {
  const day = getUtcDayKey(date);
  const baseKey = `before-you-buy:daily:${hashedIp}:${day}`;

  return {
    completedKey: `${baseKey}:completed`,
    pendingKey: `${baseKey}:pending`,
  };
}

export function parseRedisNumberArray(result: unknown, expectedValues: number) {
  if (!Array.isArray(result) || result.length < expectedValues) {
    throw new DailyLimitStoreError();
  }

  return result.slice(0, expectedValues).map((value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new DailyLimitStoreError();
    }

    return number;
  });
}

function createUsage(remaining: number, resetAt: Date): DailyUsage {
  return {
    limit: DAILY_RECOMMENDATION_LIMIT,
    remaining: Math.max(0, remaining),
    resetAt: resetAt.toISOString(),
  };
}

function timingFromReservation(reservation: DailyLimitReservation) {
  return {
    limit: DAILY_RECOMMENDATION_LIMIT,
    resetAtEpochSeconds: Math.floor(reservation.resetAt.getTime() / 1000),
  };
}
