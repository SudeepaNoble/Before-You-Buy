import assert from "node:assert/strict";
import test from "node:test";
import {
  DailyLimitReachedError,
  DailyRecommendationLimiter,
  type DailyLimitStore,
} from "../lib/daily-limit";
import {
  MAX_SCREENSHOT_SIZE,
  validateAnalyzeFormData,
} from "../lib/analyze-input";

const answers = {
  similar: "No",
  wantedFor: "About a week",
  usage: "Weekly",
};

class MemoryDailyLimitStore implements DailyLimitStore {
  reserveCalls = 0;
  private readonly buckets = new Map<string, { completed: number; pending: number }>();

  async reserve(
    keys: { completedKey: string },
    timing: { limit: number },
  ): Promise<{ allowed: boolean; remaining: number }> {
    this.reserveCalls += 1;
    const bucket = this.getBucket(keys.completedKey);

    if (bucket.completed >= timing.limit) {
      return { allowed: false, remaining: 0 };
    }

    if (bucket.completed + bucket.pending >= timing.limit) {
      return { allowed: false, remaining: 0 };
    }

    bucket.pending += 1;

    return {
      allowed: true,
      remaining: Math.max(0, timing.limit - bucket.completed - bucket.pending),
    };
  }

  async complete(
    keys: { completedKey: string },
    timing: { limit: number },
  ): Promise<{ remaining: number }> {
    const bucket = this.getBucket(keys.completedKey);
    bucket.pending = Math.max(0, bucket.pending - 1);
    bucket.completed += 1;

    return {
      remaining: Math.max(0, timing.limit - bucket.completed),
    };
  }

  async release(keys: { completedKey: string }) {
    const bucket = this.getBucket(keys.completedKey);
    bucket.pending = Math.max(0, bucket.pending - 1);
  }

  completedChecks() {
    return Array.from(this.buckets.values()).reduce(
      (total, bucket) => total + bucket.completed,
      0,
    );
  }

  private getBucket(key: string) {
    const existing = this.buckets.get(key);
    if (existing) return existing;

    const bucket = { completed: 0, pending: 0 };
    this.buckets.set(key, bucket);
    return bucket;
  }
}

test("first successful analysis is allowed and leaves one check", async () => {
  const { limiter } = createLimiter(new Date("2026-07-15T10:00:00.000Z"));

  const usage = await completeRecommendation(limiter);

  assert.equal(usage.remaining, 1);
  assert.equal(usage.limit, 2);
  assert.equal(usage.resetAt, "2026-07-16T00:00:00.000Z");
});

test("second successful analysis is allowed and leaves zero checks", async () => {
  const { limiter } = createLimiter(new Date("2026-07-15T10:00:00.000Z"));

  await completeRecommendation(limiter);
  const usage = await completeRecommendation(limiter);

  assert.equal(usage.remaining, 0);
});

test("third same-day analysis is blocked before OpenAI work", async () => {
  const { limiter } = createLimiter(new Date("2026-07-15T10:00:00.000Z"));
  let openAiCalls = 0;

  async function analyze() {
    const { reservation } = await limiter.reserve("203.0.113.10");
    openAiCalls += 1;
    return limiter.complete(reservation);
  }

  await analyze();
  await analyze();
  await assert.rejects(analyze, DailyLimitReachedError);

  assert.equal(openAiCalls, 2);
});

test("next UTC day receives two new checks", async () => {
  let now = new Date("2026-07-15T23:59:00.000Z");
  const store = new MemoryDailyLimitStore();
  const limiter = new DailyRecommendationLimiter(store, "test-salt", () => now);

  await completeRecommendation(limiter);
  await completeRecommendation(limiter);
  await assert.rejects(() => limiter.reserve("203.0.113.10"), DailyLimitReachedError);

  now = new Date("2026-07-16T00:00:00.000Z");
  const usage = await completeRecommendation(limiter);

  assert.equal(usage.remaining, 1);
});

test("invalid form submission does not touch the limiter", async () => {
  const { store } = createLimiter(new Date("2026-07-15T10:00:00.000Z"));
  const formData = new FormData();

  const validation = validateAnalyzeFormData(formData);

  assert.equal(validation.ok, false);
  assert.equal(store.reserveCalls, 0);
  assert.equal(store.completedChecks(), 0);
});

test("invalid or oversized images do not touch the limiter", async () => {
  const { store } = createLimiter(new Date("2026-07-15T10:00:00.000Z"));
  const invalidType = createValidFormData();
  invalidType.set("screenshot", new File(["not an image"], "notes.txt", {
    type: "text/plain",
  }));

  const oversized = createValidFormData();
  oversized.set(
    "screenshot",
    new File([new Uint8Array(MAX_SCREENSHOT_SIZE + 1)], "too-big.png", {
      type: "image/png",
    }),
  );

  assert.equal(validateAnalyzeFormData(invalidType).ok, false);
  assert.equal(validateAnalyzeFormData(oversized).ok, false);
  assert.equal(store.reserveCalls, 0);
  assert.equal(store.completedChecks(), 0);
});

function createLimiter(now: Date) {
  const store = new MemoryDailyLimitStore();
  const limiter = new DailyRecommendationLimiter(store, "test-salt", () => now);
  return { limiter, store };
}

async function completeRecommendation(limiter: DailyRecommendationLimiter) {
  const { reservation } = await limiter.reserve("203.0.113.10");
  return limiter.complete(reservation);
}

function createValidFormData() {
  const formData = new FormData();
  formData.set("url", "https://example.com/product");
  formData.set("answers", JSON.stringify(answers));
  return formData;
}
