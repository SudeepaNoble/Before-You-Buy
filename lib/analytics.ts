import type { Answers, RecommendationUsage } from "@/lib/analysis";
import { DAILY_RECOMMENDATION_LIMIT } from "@/lib/daily-limit";

export type AnalyticsInputType = "screenshot" | "url" | "both";
export type AnalyticsFailureType =
  | "validation"
  | "invalid_image"
  | "openai_auth"
  | "openai_billing"
  | "openai_timeout"
  | "openai_failure"
  | "malformed_response"
  | "service_unavailable"
  | "unknown";
export type AnalyticsScreenshotFileType = "jpeg" | "png" | "webp";
export type AnalyticsCategoryGroup =
  | "electronics"
  | "home"
  | "kitchen"
  | "fashion"
  | "beauty"
  | "fitness"
  | "baby"
  | "pet"
  | "office"
  | "automotive"
  | "grocery"
  | "toy"
  | "general";
export type AnalyticsTrackProperties = Record<
  string,
  string | number | boolean | null | undefined
>;
export type AnalyticsTrackEvent = (
  name: string,
  properties?: Record<string, string | number | boolean | null>,
) => void;

const similarMap: Record<Answers["similar"], "no" | "yes" | "upgrade"> = {
  No: "no",
  Yes: "yes",
  "Yes, but I want an upgrade": "upgrade",
};

const wantedDurationMap: Record<
  Answers["wantedFor"],
  "today" | "week" | "month_plus"
> = {
  "Just today": "today",
  "About a week": "week",
  "More than a month": "month_plus",
};

const usageFrequencyMap: Record<
  Answers["usage"],
  "daily" | "weekly" | "monthly" | "rarely"
> = {
  Daily: "daily",
  Weekly: "weekly",
  Monthly: "monthly",
  Rarely: "rarely",
};

const categoryMatchers: Array<{
  group: AnalyticsCategoryGroup;
  pattern: RegExp;
}> = [
  { group: "electronics", pattern: /\b(phone|laptop|tablet|tv|camera|audio|headphones?|earbuds?|monitor|console|tech|electronics?)\b/i },
  { group: "home", pattern: /\b(home|furniture|decor|bedding|storage|bath|cleaning)\b/i },
  { group: "kitchen", pattern: /\b(kitchen|cookware|appliance|coffee|blender|pan|pot|knife|dining)\b/i },
  { group: "fashion", pattern: /\b(clothing|fashion|apparel|shoe|sneaker|boot|dress|jacket|bag|handbag|accessor(y|ies)|jewelry)\b/i },
  { group: "beauty", pattern: /\b(beauty|skincare|makeup|cosmetic|fragrance|haircare)\b/i },
  { group: "fitness", pattern: /\b(fitness|gym|exercise|workout|sport|running|yoga|bike|bicycle|outdoor)\b/i },
  { group: "baby", pattern: /\b(baby|toddler|stroller|diaper|nursery)\b/i },
  { group: "pet", pattern: /\b(pet|dog|cat|animal)\b/i },
  { group: "office", pattern: /\b(office|desk|school|stationery|printer|keyboard|mouse)\b/i },
  { group: "automotive", pattern: /\b(auto|automotive|car|vehicle|tire|dashcam)\b/i },
  { group: "grocery", pattern: /\b(grocery|snack|food|drink|beverage|pantry)\b/i },
  { group: "toy", pattern: /\b(toy|game|lego|puzzle|doll)\b/i },
];

export function getAnalyticsInputType({
  hasScreenshot,
  hasUrl,
}: {
  hasScreenshot: boolean;
  hasUrl: boolean;
}): AnalyticsInputType {
  if (hasScreenshot && hasUrl) return "both";
  if (hasScreenshot) return "screenshot";
  return "url";
}

export function mapScreenshotFileType(
  mimeType: string,
): AnalyticsScreenshotFileType | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

export function isTrackableProductUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function areAnswersComplete(answers: Partial<Answers>) {
  return Boolean(answers.similar && answers.wantedFor && answers.usage);
}

export function buildRecommendationStartedProperties({
  answers,
  hasScreenshot,
  hasUrl,
}: {
  answers: Answers;
  hasScreenshot: boolean;
  hasUrl: boolean;
}) {
  return {
    inputType: getAnalyticsInputType({ hasScreenshot, hasUrl }),
    ownsSimilar: similarMap[answers.similar],
    wantedDuration: wantedDurationMap[answers.wantedFor],
    usageFrequency: usageFrequencyMap[answers.usage],
  };
}

export function buildRecommendationCompletedProperties({
  category,
  hasScreenshot,
  hasUrl,
  usage,
  verdict,
}: {
  category?: string | null;
  hasScreenshot: boolean;
  hasUrl: boolean;
  usage?: RecommendationUsage | null;
  verdict: "BUY" | "WAIT" | "SKIP";
}) {
  const remainingChecks = usage?.remaining === 0 ? "0" : "1";
  const categoryGroup = normalizeCategoryGroup(category);

  return compactProperties({
    verdict,
    inputType: getAnalyticsInputType({ hasScreenshot, hasUrl }),
    categoryGroup,
    remainingChecks,
  });
}

export function normalizeCategoryGroup(
  category?: string | null,
): AnalyticsCategoryGroup | undefined {
  if (!category) return undefined;

  const trimmed = category.trim();
  if (!trimmed || /^general product$/i.test(trimmed)) {
    return undefined;
  }

  for (const matcher of categoryMatchers) {
    if (matcher.pattern.test(trimmed)) {
      return matcher.group;
    }
  }

  return "general";
}

export function classifyAnalyzeFailure(input: {
  code?: string | null;
  status?: number;
}): AnalyticsFailureType {
  switch (input.code) {
    case "VALIDATION":
      return "validation";
    case "INVALID_IMAGE":
      return "invalid_image";
    case "OPENAI_AUTH":
      return "openai_auth";
    case "OPENAI_BILLING":
      return "openai_billing";
    case "OPENAI_TIMEOUT":
      return "openai_timeout";
    case "OPENAI_FAILURE":
      return "openai_failure";
    case "MALFORMED_RESPONSE":
      return "malformed_response";
    case "SERVICE_UNAVAILABLE":
      return "service_unavailable";
    case "UNKNOWN":
      return "unknown";
    default:
      if (input.status === 400) return "validation";
      if (input.status === 413 || input.status === 415) return "invalid_image";
      return "unknown";
  }
}

export function sanitizeAnalyticsUrl(url: string) {
  try {
    const parsed = new URL(url, "https://before-you-buy-ten.vercel.app");
    return parsed.pathname || "/";
  } catch {
    const [path] = url.split(/[?#]/, 1);
    return path || "/";
  }
}

export function createHomePageAnalytics(trackEvent: AnalyticsTrackEvent) {
  let activeRequestId: number | null = null;
  let nextRequestId = 0;
  let trackedAnswersCompleted = false;
  let trackedProductUrlAdded = false;

  const trackSafely = (
    name: string,
    properties?: Record<string, string | number | boolean | null>,
  ) => {
    try {
      trackEvent(name, properties);
    } catch {
      // Analytics must never block the product flow.
    }
  };

  const resetFlow = () => {
    activeRequestId = null;
    trackedAnswersCompleted = false;
    trackedProductUrlAdded = false;
  };

  return {
    beginRecommendation({
      answers,
      hasScreenshot,
      hasUrl,
    }: {
      answers: Answers;
      hasScreenshot: boolean;
      hasUrl: boolean;
    }) {
      if (activeRequestId !== null) return null;

      const requestId = ++nextRequestId;
      activeRequestId = requestId;
      trackSafely(
        "recommendation_started",
        buildRecommendationStartedProperties({
          answers,
          hasScreenshot,
          hasUrl,
        }),
      );
      return requestId;
    },
    completeRecommendation(
      requestId: number | null,
      input: {
        category?: string | null;
        hasScreenshot: boolean;
        hasUrl: boolean;
        usage?: RecommendationUsage | null;
        verdict: "BUY" | "WAIT" | "SKIP";
      },
    ) {
      if (requestId === null || activeRequestId !== requestId) return false;

      activeRequestId = null;
      trackSafely(
        "recommendation_completed",
        buildRecommendationCompletedProperties(input),
      );
      return true;
    },
    failRecommendation(
      requestId: number | null,
      failureType: AnalyticsFailureType,
    ) {
      if (requestId === null || activeRequestId !== requestId) return false;

      activeRequestId = null;
      trackSafely("recommendation_failed", { failureType });
      return true;
    },
    trackAnswersCompleted(answers: Partial<Answers>) {
      if (trackedAnswersCompleted || !areAnswersComplete(answers)) return false;

      trackedAnswersCompleted = true;
      trackSafely("answers_completed");
      return true;
    },
    trackDailyLimitReached(requestId: number | null) {
      if (requestId === null || activeRequestId !== requestId) return false;

      activeRequestId = null;
      trackSafely("daily_limit_reached", {
        limit: String(DAILY_RECOMMENDATION_LIMIT),
      });
      return true;
    },
    trackProductUrlAdded(url: string) {
      if (trackedProductUrlAdded || !isTrackableProductUrl(url)) return false;

      trackedProductUrlAdded = true;
      trackSafely("product_url_added");
      return true;
    },
    trackResultReset() {
      trackSafely("result_reset");
      resetFlow();
    },
    trackScreenshotSelected(fileType: AnalyticsScreenshotFileType) {
      trackSafely("screenshot_selected", { fileType });
    },
    trackValidationFailure() {
      trackSafely("recommendation_failed", { failureType: "validation" });
    },
    resetFlow,
  };
}

function compactProperties(properties: AnalyticsTrackProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null>;
}
