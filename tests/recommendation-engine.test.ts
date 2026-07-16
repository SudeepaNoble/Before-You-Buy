import assert from "node:assert/strict";
import test from "node:test";
import { recommendationScenarios } from "../lib/recommendation-scenarios";
import {
  evaluateLegacyScenarioOutcome,
  evaluateScenarioOutcome,
  finalizeRecommendation,
  type ModelRecommendation,
} from "../lib/recommendation-engine";

for (const scenario of recommendationScenarios) {
  test(`scenario ${scenario.id} produces an acceptable verdict`, () => {
    const outcome = evaluateScenarioOutcome({
      answers: scenario.answers,
      category: scenario.category,
      confidence: "medium",
      dealQuality: scenario.dealQuality,
      productName: scenario.productName,
      productUrl: scenario.productUrl,
    });

    const acceptable = new Set([
      scenario.expectedVerdict,
      ...(scenario.acceptableAlternates || []),
    ]);

    assert.equal(acceptable.has(outcome.verdict), true);
  });
}

test("legacy evaluator overuses WAIT more than the new evaluator", () => {
  const legacyWaits = recommendationScenarios.filter((scenario) => {
    return (
      evaluateLegacyScenarioOutcome({
        answers: scenario.answers,
        category: scenario.category,
        dealQuality: scenario.dealQuality,
        productName: scenario.productName,
      }) === "WAIT"
    );
  }).length;

  const nextWaits = recommendationScenarios.filter((scenario) => {
    return (
      evaluateScenarioOutcome({
        answers: scenario.answers,
        category: scenario.category,
        confidence: "medium",
        dealQuality: scenario.dealQuality,
        productName: scenario.productName,
        productUrl: scenario.productUrl,
      }).verdict === "WAIT"
    );
  }).length;

  assert.equal(nextWaits < legacyWaits, true);
});

test("finalizeRecommendation upgrades strong daily-use upgrade WAITs when signals are decisive", () => {
  const modelRecommendation: ModelRecommendation = {
    category: "Electronics",
    confidence: "medium",
    dealQuality: 50,
    futureYouSays: "This still might be worth buying, just not tonight.",
    impulseRisk: 52,
    practicalValue: 63,
    price: "Not visible",
    productName: "Laptop with faster performance",
    reasons: [
      "You'd use it every day.",
      "You've wanted it for a while.",
      "The upgrade looks meaningfully better than what you have now.",
    ],
    regretRisk: 49,
    verdict: "WAIT",
  };

  const result = finalizeRecommendation(modelRecommendation, {
    answers: {
      similar: "Yes, but I want an upgrade",
      wantedFor: "More than a month",
      usage: "Daily",
    },
    hasScreenshot: true,
    productUrl: "",
  });

  assert.equal(result.recommendation.verdict, "BUY");
  assert.equal(result.recommendation.practicalValue >= 68, true);
  assert.equal(result.recommendation.regretRisk <= 52, true);
});

test("finalizeRecommendation keeps rare duplicate novelty purchases out of WAIT", () => {
  const modelRecommendation: ModelRecommendation = {
    category: "Viral gadget",
    confidence: "medium",
    dealQuality: 80,
    futureYouSays: "If you still want it soon, that will be a much better signal.",
    impulseRisk: 60,
    practicalValue: 38,
    price: "$19",
    productName: "Viral mini gadget",
    reasons: [
      "This feels like a trend purchase.",
      "You probably won't use it much.",
      "The discount is tempting, but the value still looks weak.",
    ],
    regretRisk: 62,
    verdict: "WAIT",
  };

  const result = finalizeRecommendation(modelRecommendation, {
    answers: {
      similar: "Yes",
      wantedFor: "Just today",
      usage: "Rarely",
    },
    hasScreenshot: true,
    productUrl: "",
  });

  assert.equal(result.recommendation.verdict, "SKIP");
  assert.equal(result.recommendation.practicalValue <= 45, true);
  assert.equal(result.recommendation.regretRisk >= 62, true);
});
