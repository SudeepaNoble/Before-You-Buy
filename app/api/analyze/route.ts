import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import type { AnalyticsFailureType } from "@/lib/analytics";
import { validateAnalyzeFormData } from "@/lib/analyze-input";
import {
  DAILY_LIMIT_ERROR,
  DAILY_LIMIT_MESSAGE,
  DailyLimitConfigurationError,
  DailyLimitReachedError,
  DailyLimitStoreError,
  TEMPORARY_CHECKS_UNAVAILABLE_MESSAGE,
  type DailyLimitReservation,
  type DailyRecommendationLimiter,
  getDailyRecommendationLimiter,
} from "@/lib/daily-limit";
import { getClientIp } from "@/lib/get-client-ip";
import {
  buildUserPrompt,
  finalizeRecommendation,
  modelRecommendationSchema,
  SYSTEM_PROMPT,
  type RecommendationContext,
} from "@/lib/recommendation-engine";

export const runtime = "nodejs";
export const maxDuration = 30;

const CHECKS_UNAVAILABLE_ERROR = "CHECKS_UNAVAILABLE";
const SERVICE_UNAVAILABLE_MESSAGE = "The recommendation service is not configured yet.";

type SafeAnalyzeErrorCode =
  | "VALIDATION"
  | "INVALID_IMAGE"
  | "OPENAI_AUTH"
  | "OPENAI_BILLING"
  | "OPENAI_TIMEOUT"
  | "OPENAI_FAILURE"
  | "MALFORMED_RESPONSE"
  | "SERVICE_UNAVAILABLE"
  | "UNKNOWN";

export async function POST(request: Request) {
  let limiter: DailyRecommendationLimiter | null = null;
  let reservation: DailyLimitReservation | null = null;
  let completionAttempted = false;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          code: "SERVICE_UNAVAILABLE" satisfies SafeAnalyzeErrorCode,
          error: SERVICE_UNAVAILABLE_MESSAGE,
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const validation = validateAnalyzeFormData(formData);

    if (!validation.ok) {
      return NextResponse.json(
        {
          code: validation.status === 413 || validation.status === 415
            ? ("INVALID_IMAGE" satisfies SafeAnalyzeErrorCode)
            : ("VALIDATION" satisfies SafeAnalyzeErrorCode),
          error: validation.error,
        },
        { status: validation.status },
      );
    }

    const { answers, productUrl, screenshot } = validation.input;
    const recommendationContext: RecommendationContext = {
      answers,
      hasScreenshot: screenshot instanceof File,
      productUrl,
    };

    const clientIp = getClientIp(request) || getLocalDevelopmentIp();
    if (!clientIp) {
      throw new DailyLimitConfigurationError();
    }

    limiter = getDailyRecommendationLimiter();
    const rateLimit = await limiter.reserve(clientIp);
    reservation = rateLimit.reservation;

    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: "input_text",
        text: buildUserPrompt(answers, productUrl, screenshot instanceof File),
      },
    ];

    if (screenshot instanceof File) {
      const base64 = Buffer.from(await screenshot.arrayBuffer()).toString("base64");
      content.push({
        type: "input_image",
        image_url: `data:${screenshot.type};base64,${base64}`,
        detail: "high",
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 1,
      timeout: 25_000,
    });

    const response = await openai.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      reasoning: { effort: "low" },
      text: {
        format: zodTextFormat(modelRecommendationSchema, "purchase_recommendation"),
      },
      max_output_tokens: 1000,
      store: false,
    });

    if (!response.output_parsed) {
      if (reservation && limiter) {
        await releaseDailyLimitReservation(limiter, reservation);
        reservation = null;
      }

      return NextResponse.json(
        {
          code: "MALFORMED_RESPONSE" satisfies SafeAnalyzeErrorCode,
          error: "We could not form a recommendation. Please try again.",
        },
        { status: 502 },
      );
    }

    completionAttempted = true;
    const usage = await limiter.complete(reservation);
    reservation = null;
    const finalized = finalizeRecommendation(
      response.output_parsed,
      recommendationContext,
    );

    return NextResponse.json({
      ...finalized.recommendation,
      usage,
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logSafeFailure("Product analysis failed", mapAnalyticsFailureType(error));

    if (reservation && limiter && !completionAttempted) {
      await releaseDailyLimitReservation(limiter, reservation);
    }

    if (error instanceof DailyLimitReachedError) {
      return NextResponse.json(
        {
          error: DAILY_LIMIT_ERROR,
          message: DAILY_LIMIT_MESSAGE,
          limit: error.usage.limit,
          remaining: error.usage.remaining,
          resetAt: error.usage.resetAt,
        },
        { status: 429 },
      );
    }

    if (
      error instanceof DailyLimitConfigurationError ||
      error instanceof DailyLimitStoreError
    ) {
      console.error("Daily recommendation checks are unavailable");
      return NextResponse.json(
        {
          code: "SERVICE_UNAVAILABLE" satisfies SafeAnalyzeErrorCode,
          error: CHECKS_UNAVAILABLE_ERROR,
          message: TEMPORARY_CHECKS_UNAVAILABLE_MESSAGE,
        },
        { status: 503 },
      );
    }

    if (error instanceof OpenAI.AuthenticationError) {
      return NextResponse.json(
        {
          code: "OPENAI_AUTH" satisfies SafeAnalyzeErrorCode,
          error: SERVICE_UNAVAILABLE_MESSAGE,
        },
        { status: 503 },
      );
    }

    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return NextResponse.json(
        {
          code: "OPENAI_TIMEOUT" satisfies SafeAnalyzeErrorCode,
          error: "The recommendation service timed out. Please try again.",
        },
        { status: 504 },
      );
    }

    if (error instanceof OpenAI.RateLimitError) {
      if (error.code === "insufficient_quota") {
        return NextResponse.json(
          {
            code: "OPENAI_BILLING" satisfies SafeAnalyzeErrorCode,
            error:
              "OpenAI API billing is not active yet. Add billing or credits to this API project, then try again.",
          },
          { status: 402 },
        );
      }

      return NextResponse.json(
        {
          code: "OPENAI_FAILURE" satisfies SafeAnalyzeErrorCode,
          error: "We are handling a lot of decisions right now. Try again shortly.",
        },
        { status: 429 },
      );
    }

    if (
      error instanceof OpenAI.APIConnectionError ||
      error instanceof OpenAI.InternalServerError
    ) {
      return NextResponse.json(
        {
          code: "OPENAI_FAILURE" satisfies SafeAnalyzeErrorCode,
          error: "We could not analyze this product. Please try again.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        code: "UNKNOWN" satisfies SafeAnalyzeErrorCode,
        error: "We could not analyze this product. Please try again.",
      },
      { status: 500 },
    );
  }
}

function getLocalDevelopmentIp() {
  if (process.env.NODE_ENV === "production") return null;
  return "local-development";
}

async function releaseDailyLimitReservation(
  limiter: DailyRecommendationLimiter,
  reservation: DailyLimitReservation,
) {
  try {
    await limiter.release(reservation);
  } catch {
    console.error("Daily recommendation reservation release failed");
  }
}

function mapAnalyticsFailureType(error: unknown): AnalyticsFailureType {
  if (error instanceof DailyLimitReachedError) {
    return "unknown";
  }

  if (
    error instanceof DailyLimitConfigurationError ||
    error instanceof DailyLimitStoreError
  ) {
    return "service_unavailable";
  }

  if (error instanceof OpenAI.AuthenticationError) {
    return "openai_auth";
  }

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return "openai_timeout";
  }

  if (error instanceof OpenAI.RateLimitError) {
    return error.code === "insufficient_quota" ? "openai_billing" : "openai_failure";
  }

  if (
    error instanceof OpenAI.APIConnectionError ||
    error instanceof OpenAI.InternalServerError
  ) {
    return "openai_failure";
  }

  return "unknown";
}

function logSafeFailure(message: string, failureType: AnalyticsFailureType) {
  console.error(message, { failureType });
}
