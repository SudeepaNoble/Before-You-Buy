import { z } from "zod";
import { recommendationSchema, type Answers, type Recommendation } from "@/lib/analysis";

export const modelRecommendationSchema = recommendationSchema.extend({
  confidence: z.enum(["high", "medium", "low"]),
});

export type Verdict = Recommendation["verdict"];
export type Confidence = z.infer<typeof modelRecommendationSchema>["confidence"];
export type ModelRecommendation = z.infer<typeof modelRecommendationSchema>;
export type RecommendationContext = {
  answers: Answers;
  hasScreenshot: boolean;
  productUrl: string;
};
export type RecommendationEvaluation = {
  confidence: Confidence;
  notes: string[];
  verdict: Verdict;
};

type CategoryGroup =
  | "reading"
  | "electronics"
  | "beauty"
  | "fashion"
  | "decor"
  | "fitness"
  | "kitchen"
  | "travel"
  | "work"
  | "consumable"
  | "hobby"
  | "general";

type Signals = {
  aspirationalRisk: boolean;
  categoryGroup: CategoryGroup;
  cosmeticUpgradeRisk: boolean;
  lowInfo: boolean;
  meaningfulUpgradeCategory: boolean;
  noveltyRisk: boolean;
  recurringUseCategory: boolean;
  replenishmentLikely: boolean;
  singlePurposeRisk: boolean;
};

const categoryMatchers: Array<{ group: CategoryGroup; pattern: RegExp }> = [
  { group: "reading", pattern: /\b(kindle|ebook|e-reader|book light|reading)\b/i },
  { group: "electronics", pattern: /\b(laptop|phone|tablet|monitor|camera|headphones?|earbuds?|keyboard|mouse|charger|speaker|tv|electronics?)\b/i },
  { group: "beauty", pattern: /\b(skincare|serum|cleanser|moisturizer|sunscreen|beauty|makeup|shampoo|conditioner|hair dryer|blow dryer|hair tool)\b/i },
  { group: "fashion", pattern: /\b(dress|shirt|pants|jeans|jacket|coat|bag|handbag|shoe|sneaker|boot|fashion|wardrobe|jewelry)\b/i },
  { group: "decor", pattern: /\b(vase|decor|candle|throw pillow|art print|ornament|wall art|home decor)\b/i },
  { group: "fitness", pattern: /\b(running|runner|gym|fitness|workout|dumbbell|treadmill|walking pad|yoga|exercise|bike)\b/i },
  { group: "kitchen", pattern: /\b(air fryer|blender|toaster|coffee|espresso|pan|pot|kitchen|appliance|cookware)\b/i },
  { group: "travel", pattern: /\b(luggage|suitcase|carry-on|passport|travel|packing)\b/i },
  { group: "work", pattern: /\b(desk|chair|office|study|planner|notebook|printer|webcam)\b/i },
  { group: "consumable", pattern: /\b(refill|replacement|pods|beans|supplement|vitamin|cleanser refill|razor blades|toothpaste|soap)\b/i },
  { group: "hobby", pattern: /\b(craft|gaming|game|lego|puzzle|guitar|camera accessory|painting|hobby)\b/i },
];

const noveltyPattern =
  /\b(viral|tiktok|trend|trendy|gimmick|mini gadget|novelty|aesthetic|must-have)\b/i;
const replenishmentPattern =
  /\b(refill|replacement|replenish|restock|staple|finished|empty|pod|pods|beans|cartridge|blades)\b/i;
const cosmeticUpgradePattern =
  /\b(cosmetic|color|colorway|trendier|aesthetic|cute|style|status|look)\b/i;
const meaningfulUpgradePattern =
  /\b(ergonomic|faster|lighter|quieter|stronger|performance|replace|broken|uncomfortable|outdated|weak|upgrade)\b/i;
const singlePurposePattern =
  /\b(single-purpose|mini waffle|novelty appliance|specialty|one-use)\b/i;

export const SYSTEM_PROMPT = `You are Before You Buy, a practical friend helping someone decide whether to BUY, WAIT, or SKIP a purchase.

Core principle:
Answer this question: if a thoughtful friend understood the product, the user's habits, and the timing, would they honestly say buy it, wait, or skip it?

Important:
- Do not default to WAIT just because the evidence is mixed or some product details are unclear.
- BUY is appropriate for non-essential items too when they fit a real routine, solve a recurring problem, or meaningfully improve daily life.
- SKIP is appropriate when the item is likely to duplicate, clutter, or serve an imagined future self more than the current one.

Use these signals with human weighting, not equal weighting:

Very strong positive:
- solves a recurring problem
- daily use
- replacement of something broken, weak, outdated, or uncomfortable
- clear functional upgrade

Strong positive:
- weekly use
- wanted for more than a month
- no adequate similar item
- clear deal signal

Moderate:
- wanted about a week
- monthly use
- category-specific utility
- moderate deal signal

Weak / cautionary:
- wanted just today
- vague sale language
- trend appeal
- cosmetic-only upgrade

How to use verdicts:
- BUY when practical value is clearly strong, likely use is real, and regret risk is low or moderate.
- WAIT when the item may make sense but timing is questionable, evidence is genuinely mixed, or a cooling-off period would clarify the choice.
- SKIP when expected use is low, the item is duplicative, the habit is aspirational, or regret/clutter risk is high.

Specific reasoning rules:
- Daily use should usually outweigh "wanted it just today."
- "Yes, but I want an upgrade" is not the same as plain duplication. Decide whether the upgrade is meaningful or mostly cosmetic.
- No visible discount should not automatically force WAIT if practical value is strong.
- A strong discount should not rescue a weak or duplicate purchase.
- Distinguish current habits from imagined future habits.
- Replenishment of a daily staple is not the same as unnecessary duplication.
- Missing product details lower confidence, but low confidence does not automatically mean WAIT.

Category-aware common sense:
- Reading devices: frequent readers can justify BUY; rare readers usually should not.
- Hair tools, electronics, work tools, and desk setups can justify upgrades when the improvement affects daily routine.
- Fashion, decor, and beauty are not automatically frivolous, but duplicates and rare use should increase regret risk.
- Fitness products should respect whether there is an existing routine or an aspirational one.
- Kitchen gadgets and hobby items should be judged by realistic repeated use, not imagined enthusiasm.
- Consumables and refills can be practical even when the user already owns similar items.

Scoring rules:
- Deal Quality reflects only visible or inferable deal quality. Unknown deal quality is neutral, not bad.
- Impulse Risk reflects recency, duplication, novelty/trendiness, and low expected use.
- Practical Value reflects repeated use, routine fit, recurring problem solved, replacement value, and meaningful upgrade value.
- Regret Risk reflects duplication, clutter, low use, weak need, aspirational behavior, and mismatch between excitement and actual routine.

Score and verdict consistency:
- BUY should usually have high practical value and low-to-moderate regret risk.
- SKIP should usually have high regret risk and low-to-moderate practical value.
- WAIT should usually show mixed scores or questionable timing.
- Avoid contradictions like BUY with very low practical value or SKIP with very low regret risk unless there is a clearly explained exceptional reason.

Output requirements:
- Return productName, price, category, verdict, dealQuality, impulseRisk, practicalValue, regretRisk, reasons, futureYouSays, and confidence.
- Use "Unknown" or "Not clear from screenshot" when needed instead of inventing details.
- reasons must contain exactly three concise, product-specific, answer-specific reasons.
- futureYouSays must be one casual, memorable sentence.
- confidence must be high, medium, or low.
- Avoid phrases like "based on the information provided" or "the analysis suggests."`;

export function buildUserPrompt(
  answers: Answers,
  productUrl: string,
  hasScreenshot: boolean,
) {
  return `Analyze this potential purchase.

Product source:
- Screenshot provided: ${hasScreenshot ? "Yes — prioritize it" : "No"}
- Product URL: ${productUrl || "Not provided"}
- Do not browse or scrape the URL. Treat its domain/path text only as weak context.

User answers:
- Already owns something similar: ${answers.similar}
- Has wanted it for: ${answers.wantedFor}
- Realistic use frequency: ${answers.usage}

Use the decision hierarchy carefully and return the requested structured recommendation.`;
}

export function finalizeRecommendation(
  recommendation: ModelRecommendation,
  context: RecommendationContext,
) {
  const signals = inferSignals(recommendation, context);
  const adjusted = adjustScores(recommendation, context, signals);
  const evaluation = evaluateRecommendation(adjusted, context, signals);
  const verdict = chooseFinalVerdict(adjusted.verdict, evaluation);
  const aligned = alignScoresWithVerdict({ ...adjusted, verdict }, signals);

  return {
    confidence: evaluation.confidence,
    recommendation: {
      category: aligned.category,
      dealQuality: aligned.dealQuality,
      futureYouSays: alignFutureYouSays(aligned.futureYouSays, verdict, evaluation.confidence),
      impulseRisk: aligned.impulseRisk,
      practicalValue: aligned.practicalValue,
      price: aligned.price,
      productName: aligned.productName,
      reasons: aligned.reasons,
      regretRisk: aligned.regretRisk,
      verdict,
    },
  };
}

export function evaluateScenarioOutcome(
  input: Pick<RecommendationContext, "answers"> & {
    category: string;
    confidence?: Confidence;
    dealQuality: number;
    price?: string;
    productName: string;
    productUrl?: string;
  },
) {
  const recommendation: ModelRecommendation = {
    category: input.category,
    confidence: input.confidence || "medium",
    dealQuality: input.dealQuality,
    futureYouSays: "Placeholder",
    impulseRisk: 50,
    practicalValue: 50,
    price: input.price || "Unknown",
    productName: input.productName,
    reasons: ["One", "Two", "Three"],
    regretRisk: 50,
    verdict: "WAIT",
  };

  const signals = inferSignals(recommendation, {
    answers: input.answers,
    hasScreenshot: true,
    productUrl: input.productUrl || "",
  });
  const adjusted = adjustScores(
    recommendation,
    {
      answers: input.answers,
      hasScreenshot: true,
      productUrl: input.productUrl || "",
    },
    signals,
  );

  return evaluateRecommendation(
    adjusted,
    {
      answers: input.answers,
      hasScreenshot: true,
      productUrl: input.productUrl || "",
    },
    signals,
  );
}

export function evaluateLegacyScenarioOutcome(
  input: Pick<RecommendationContext, "answers"> & {
    category: string;
    dealQuality: number;
    productName: string;
  },
): Verdict {
  const text = `${input.productName} ${input.category}`.toLowerCase();
  const similar = input.answers.similar;
  const wanted = input.answers.wantedFor;
  const usage = input.answers.usage;
  const hasPracticalCategory = /\b(kindle|laptop|chair|running|shoes|skincare|hair dryer|office|desk)\b/.test(
    text,
  );

  if (similar === "Yes" && usage === "Rarely") return "SKIP";
  if (
    similar === "No" &&
    wanted === "More than a month" &&
    usage === "Daily" &&
    hasPracticalCategory &&
    input.dealQuality >= 45
  ) {
    return "BUY";
  }

  if (similar === "Yes, but I want an upgrade" && usage === "Rarely") {
    return "WAIT";
  }

  return "WAIT";
}

function inferSignals(
  recommendation: Pick<ModelRecommendation, "category" | "price" | "productName">,
  context: RecommendationContext,
): Signals {
  const text = `${recommendation.productName} ${recommendation.category} ${context.productUrl}`.toLowerCase();
  const categoryGroup =
    categoryMatchers.find((matcher) => matcher.pattern.test(text))?.group || "general";
  const lowInfo =
    /unknown|general product|not clear from screenshot/i.test(recommendation.category) ||
    /unknown|not visible/i.test(recommendation.price) ||
    (!context.hasScreenshot && !context.productUrl);
  const recurringUseCategory = ["reading", "electronics", "beauty", "fitness", "work"].includes(
    categoryGroup,
  );
  const meaningfulUpgradeCategory = ["electronics", "beauty", "work", "fitness"].includes(
    categoryGroup,
  ) || meaningfulUpgradePattern.test(text);
  const aspirationalRisk =
    ["fitness", "hobby", "kitchen"].includes(categoryGroup) &&
    context.answers.wantedFor === "Just today";

  return {
    aspirationalRisk,
    categoryGroup,
    cosmeticUpgradeRisk: cosmeticUpgradePattern.test(text),
    lowInfo,
    meaningfulUpgradeCategory,
    noveltyRisk: noveltyPattern.test(text),
    recurringUseCategory,
    replenishmentLikely: replenishmentPattern.test(text) || categoryGroup === "consumable",
    singlePurposeRisk:
      singlePurposePattern.test(text) || (categoryGroup === "kitchen" && /\bmini|specialty\b/.test(text)),
  };
}

function adjustScores(
  recommendation: ModelRecommendation,
  context: RecommendationContext,
  signals: Signals,
) {
  let dealQuality = recommendation.dealQuality;
  let impulseRisk = recommendation.impulseRisk;
  let practicalValue = recommendation.practicalValue;
  let regretRisk = recommendation.regretRisk;

  switch (context.answers.usage) {
    case "Daily":
      practicalValue += 18;
      impulseRisk -= 6;
      regretRisk -= 12;
      break;
    case "Weekly":
      practicalValue += 11;
      regretRisk -= 6;
      break;
    case "Monthly":
      practicalValue += 1;
      regretRisk += 4;
      break;
    case "Rarely":
      practicalValue -= 18;
      impulseRisk += 10;
      regretRisk += 18;
      break;
  }

  switch (context.answers.wantedFor) {
    case "More than a month":
      impulseRisk -= 12;
      regretRisk -= 8;
      break;
    case "About a week":
      impulseRisk -= 4;
      break;
    case "Just today":
      impulseRisk += 12;
      regretRisk += 8;
      break;
  }

  switch (context.answers.similar) {
    case "No":
      practicalValue += 6;
      break;
    case "Yes":
      practicalValue -= signals.replenishmentLikely ? -8 : 8;
      regretRisk += signals.replenishmentLikely ? -8 : 14;
      break;
    case "Yes, but I want an upgrade":
      if (signals.meaningfulUpgradeCategory && context.answers.usage !== "Rarely") {
        practicalValue += 10;
        regretRisk -= 6;
      } else {
        practicalValue -= 5;
        regretRisk += signals.cosmeticUpgradeRisk ? 10 : 4;
      }
      break;
  }

  if (signals.recurringUseCategory && ["Daily", "Weekly"].includes(context.answers.usage)) {
    practicalValue += 9;
  }

  if (signals.replenishmentLikely && ["Daily", "Weekly"].includes(context.answers.usage)) {
    practicalValue += 14;
    regretRisk -= 10;
  }

  if (signals.noveltyRisk) {
    impulseRisk += 10;
    regretRisk += 8;
  }

  if (signals.singlePurposeRisk && context.answers.usage !== "Daily") {
    practicalValue -= 8;
    regretRisk += 8;
  }

  if (signals.aspirationalRisk && context.answers.usage === "Daily") {
    practicalValue -= 8;
    regretRisk += 12;
  }

  if (signals.categoryGroup === "decor" && context.answers.usage === "Rarely") {
    practicalValue -= 10;
    regretRisk += 10;
  }

  if (signals.lowInfo) {
    dealQuality = Math.max(40, Math.min(60, dealQuality));
  }

  return {
    ...recommendation,
    dealQuality: clampScore(dealQuality),
    impulseRisk: clampScore(impulseRisk),
    practicalValue: clampScore(practicalValue),
    regretRisk: clampScore(regretRisk),
  };
}

function evaluateRecommendation(
  recommendation: Pick<
    ModelRecommendation,
    "confidence" | "dealQuality" | "impulseRisk" | "practicalValue" | "regretRisk"
  >,
  context: RecommendationContext,
  signals: Signals,
): RecommendationEvaluation {
  const notes: string[] = [];
  const dailyOrWeekly = ["Daily", "Weekly"].includes(context.answers.usage);
  const wantedLong = context.answers.wantedFor === "More than a month";
  const duplicate = context.answers.similar === "Yes" && !signals.replenishmentLikely;
  const meaningfulUpgrade =
    context.answers.similar === "Yes, but I want an upgrade" &&
    signals.meaningfulUpgradeCategory &&
    !signals.cosmeticUpgradeRisk;

  const strongBuy =
    recommendation.practicalValue >= 70 &&
    recommendation.regretRisk <= 50 &&
    (dailyOrWeekly || signals.replenishmentLikely || meaningfulUpgrade) &&
    (!signals.aspirationalRisk || wantedLong);

  const strongSkip =
    recommendation.practicalValue <= 42 &&
    recommendation.regretRisk >= 64 &&
    (context.answers.usage === "Rarely" ||
      duplicate ||
      signals.noveltyRisk ||
      signals.singlePurposeRisk);

  if (strongBuy) {
    notes.push("strong_buy_signals");
  }

  if (strongSkip) {
    notes.push("strong_skip_signals");
  }

  if (
    context.answers.similar === "Yes, but I want an upgrade" &&
    signals.cosmeticUpgradeRisk &&
    context.answers.wantedFor === "Just today"
  ) {
    return {
      confidence: "medium",
      notes: [...notes, "cosmetic_upgrade"],
      verdict: context.answers.usage === "Rarely" ? "SKIP" : "WAIT",
    };
  }

  if (
    signals.aspirationalRisk &&
    context.answers.wantedFor === "Just today" &&
    context.answers.usage === "Daily"
  ) {
    notes.push("possible_aspirational_habit");
  }

  if (strongBuy) {
    return {
      confidence: recommendation.confidence === "low" ? "medium" : recommendation.confidence,
      notes,
      verdict: "BUY",
    };
  }

  if (strongSkip) {
    return {
      confidence: recommendation.confidence === "low" ? "medium" : recommendation.confidence,
      notes,
      verdict: "SKIP",
    };
  }

  if (
    signals.aspirationalRisk &&
    context.answers.wantedFor === "Just today" &&
    recommendation.practicalValue < 70
  ) {
    return {
      confidence: "medium",
      notes,
      verdict: "WAIT",
    };
  }

  return {
    confidence: recommendation.confidence,
    notes,
    verdict: "WAIT",
  };
}

function chooseFinalVerdict(modelVerdict: Verdict, evaluation: RecommendationEvaluation) {
  if (modelVerdict === evaluation.verdict) return modelVerdict;

  if (modelVerdict === "WAIT" && evaluation.verdict !== "WAIT") {
    return evaluation.verdict;
  }

  if (modelVerdict === "BUY" && evaluation.verdict === "SKIP") {
    return "WAIT";
  }

  if (modelVerdict === "SKIP" && evaluation.verdict === "BUY") {
    return "WAIT";
  }

  return evaluation.verdict;
}

function alignScoresWithVerdict(
  recommendation: ModelRecommendation,
  signals: Signals,
): ModelRecommendation {
  const next = { ...recommendation };

  if (next.verdict === "BUY") {
    next.practicalValue = Math.max(next.practicalValue, 68);
    next.regretRisk = Math.min(next.regretRisk, 52);
    next.impulseRisk = Math.min(next.impulseRisk, 60);
  }

  if (next.verdict === "SKIP") {
    next.practicalValue = Math.min(next.practicalValue, 45);
    next.regretRisk = Math.max(next.regretRisk, 62);
    next.impulseRisk = Math.max(next.impulseRisk, signals.noveltyRisk ? 65 : 55);
  }

  if (next.verdict === "WAIT") {
    next.practicalValue = clampScore(next.practicalValue);
    next.regretRisk = clampScore(next.regretRisk);
  }

  next.dealQuality = clampScore(next.dealQuality);
  next.impulseRisk = clampScore(next.impulseRisk);
  next.practicalValue = clampScore(next.practicalValue);
  next.regretRisk = clampScore(next.regretRisk);

  return next;
}

function alignFutureYouSays(
  current: string,
  verdict: Verdict,
  confidence: Confidence,
) {
  if (current.trim().length > 0 && !/^based on|^the analysis/i.test(current.trim())) {
    return current;
  }

  if (verdict === "BUY") {
    return confidence === "high"
      ? "Future you will probably be glad this became part of your routine."
      : "Future you will probably appreciate this if you use it the way you expect.";
  }

  if (verdict === "SKIP") {
    return "Future you will likely prefer the saved money to another duplicate.";
  }

  return "If you still want it soon, that will be a much better signal.";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
