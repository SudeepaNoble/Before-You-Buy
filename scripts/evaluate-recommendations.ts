import { recommendationScenarios } from "../lib/recommendation-scenarios";
import {
  evaluateLegacyScenarioOutcome,
  evaluateScenarioOutcome,
  type Verdict,
} from "../lib/recommendation-engine";

type ScenarioReport = {
  changed: boolean;
  id: string;
  legacy: Verdict;
  next: Verdict;
  note: string;
};

const reports: ScenarioReport[] = recommendationScenarios.map((scenario) => {
  const legacy = evaluateLegacyScenarioOutcome({
    answers: scenario.answers,
    category: scenario.category,
    dealQuality: scenario.dealQuality,
    productName: scenario.productName,
  });
  const next = evaluateScenarioOutcome({
    answers: scenario.answers,
    category: scenario.category,
    confidence: "medium",
    dealQuality: scenario.dealQuality,
    productName: scenario.productName,
    productUrl: scenario.productUrl,
  }).verdict;

  return {
    changed: legacy !== next,
    id: scenario.id,
    legacy,
    next,
    note: scenario.explanation,
  };
});

const summary = {
  BUY: reports.filter((report) => report.next === "BUY").length,
  WAIT: reports.filter((report) => report.next === "WAIT").length,
  SKIP: reports.filter((report) => report.next === "SKIP").length,
};

console.log(JSON.stringify({
  changedScenarios: reports.filter((report) => report.changed),
  summary,
  total: reports.length,
}, null, 2));
