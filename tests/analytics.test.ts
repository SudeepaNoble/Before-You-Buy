import assert from "node:assert/strict";
import test from "node:test";
import type { Answers, RecommendationUsage } from "../lib/analysis";
import {
  buildRecommendationCompletedProperties,
  buildRecommendationStartedProperties,
  classifyAnalyzeFailure,
  createHomePageAnalytics,
  sanitizeAnalyticsUrl,
} from "../lib/analytics";

const answers: Answers = {
  similar: "Yes, but I want an upgrade",
  wantedFor: "About a week",
  usage: "Weekly",
};

const usage: RecommendationUsage = {
  limit: 2,
  remaining: 1,
  resetAt: "2026-07-16T00:00:00.000Z",
};

test("started event uses only predefined categorical values", () => {
  const payload = buildRecommendationStartedProperties({
    answers,
    hasScreenshot: true,
    hasUrl: true,
  });

  assert.deepEqual(payload, {
    inputType: "both",
    ownsSimilar: "upgrade",
    wantedDuration: "week",
    usageFrequency: "weekly",
  });
  assert.equal("productName" in payload, false);
  assert.equal("price" in payload, false);
});

test("completed event excludes raw category text and keeps only safe fields", () => {
  const payload = buildRecommendationCompletedProperties({
    category: "Wireless Headphones",
    hasScreenshot: true,
    hasUrl: false,
    usage,
    verdict: "BUY",
  });

  assert.deepEqual(payload, {
    verdict: "BUY",
    inputType: "screenshot",
    categoryGroup: "electronics",
    remainingChecks: "1",
  });
  assert.equal("category" in payload, false);
  assert.equal("productUrl" in payload, false);
  assert.equal("futureYouSays" in payload, false);
});

test("tracker only fires one answers_completed and one product_url_added event per flow", () => {
  const events: Array<{ name: string; properties?: Record<string, unknown> }> = [];
  const analytics = createHomePageAnalytics((name, properties) => {
    events.push({ name, properties });
  });

  analytics.trackProductUrlAdded("https://example.com/product");
  analytics.trackProductUrlAdded("https://example.com/product");
  analytics.trackAnswersCompleted({ similar: "No" });
  analytics.trackAnswersCompleted({
    similar: "No",
    wantedFor: "Just today",
    usage: "Daily",
  });
  analytics.trackAnswersCompleted({
    similar: "No",
    wantedFor: "About a week",
    usage: "Weekly",
  });

  assert.deepEqual(events, [
    { name: "product_url_added", properties: undefined },
    { name: "answers_completed", properties: undefined },
  ]);
});

test("tracker only completes or fails an active request once", () => {
  const events: Array<{ name: string; properties?: Record<string, unknown> }> = [];
  const analytics = createHomePageAnalytics((name, properties) => {
    events.push({ name, properties });
  });

  const requestId = analytics.beginRecommendation({
    answers,
    hasScreenshot: true,
    hasUrl: false,
  });

  analytics.completeRecommendation(requestId, {
    category: "Laptop",
    hasScreenshot: true,
    hasUrl: false,
    usage,
    verdict: "WAIT",
  });
  analytics.completeRecommendation(requestId, {
    category: "Laptop",
    hasScreenshot: true,
    hasUrl: false,
    usage,
    verdict: "WAIT",
  });
  analytics.failRecommendation(requestId, "unknown");

  assert.equal(events.length, 2);
  assert.equal(events[0]?.name, "recommendation_started");
  assert.equal(events[1]?.name, "recommendation_completed");
});

test("tracker fires daily_limit_reached without leaking identifiers", () => {
  const events: Array<{ name: string; properties?: Record<string, unknown> }> = [];
  const analytics = createHomePageAnalytics((name, properties) => {
    events.push({ name, properties });
  });

  const requestId = analytics.beginRecommendation({
    answers,
    hasScreenshot: false,
    hasUrl: true,
  });

  analytics.trackDailyLimitReached(requestId);

  assert.deepEqual(events.at(-1), {
    name: "daily_limit_reached",
    properties: { limit: "2" },
  });
  assert.equal(JSON.stringify(events).includes("203.0.113"), false);
  assert.equal(JSON.stringify(events).includes("sha256"), false);
});

test("failure classification maps safe server codes", () => {
  assert.equal(
    classifyAnalyzeFailure({ status: 402, code: "OPENAI_BILLING" }),
    "openai_billing",
  );
  assert.equal(
    classifyAnalyzeFailure({ status: 503, code: "SERVICE_UNAVAILABLE" }),
    "service_unavailable",
  );
  assert.equal(classifyAnalyzeFailure({ status: 415 }), "invalid_image");
});

test("analytics url sanitization strips query strings and hashes", () => {
  assert.equal(
    sanitizeAnalyticsUrl(
      "https://before-you-buy-ten.vercel.app/?product=https://store.example/item#details",
    ),
    "/",
  );
});
