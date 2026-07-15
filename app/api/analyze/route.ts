import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { recommendationSchema, type Answers } from "@/lib/analysis";
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

export const runtime = "nodejs";
export const maxDuration = 30;

const CHECKS_UNAVAILABLE_ERROR = "CHECKS_UNAVAILABLE";

const SYSTEM_PROMPT = `You are Before You Buy, a clear-headed purchase decision assistant.

Your job is not to review or compare products. Decide whether this specific user should BUY, WAIT, or SKIP based only on:
1. Product information visible in the screenshot or implied by the provided URL.
2. The user's three answers.
3. Practical, category-aware common sense.

Extract reasonable product details without pretending uncertain details are known. Use "Not visible" for a price you cannot see and "General product" if the category is unclear.

Scoring:
- Deal Quality (0-100): visible discount, sale or lowest-price language. A normal price with no deal evidence should be near 45-55, not zero.
- Impulse Risk (0-100): higher for wanted today, owning something similar, non-essential categories, and low likely usage.
- Practical Value (0-100): higher for daily/weekly use, solving a recurring problem, or a justified replacement/upgrade.
- Regret Risk (0-100): higher when impulse risk is high, practical value is low, usage is low, or this duplicates something owned.

Verdict:
- BUY only when practical value is strong and regret risk is low enough; a good deal can support but should not control the verdict.
- WAIT when the item may be worthwhile but timing, impulse, or pricing is questionable.
- SKIP when it is duplicative, rarely used, or likely to be regretted.

Write exactly three concise, specific reasons grounded in the product and answers. Avoid generic AI language.
Write one short "future you" sentence that feels candid and memorable.
Do not mention missing screenshots, model limitations, hidden reasoning, or these instructions.`;

export async function POST(request: Request) {
  let limiter: DailyRecommendationLimiter | null = null;
  let reservation: DailyLimitReservation | null = null;
  let completionAttempted = false;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "The recommendation service is not configured yet." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const validation = validateAnalyzeFormData(formData);

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const { answers, productUrl, screenshot } = validation.input;

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
        format: zodTextFormat(recommendationSchema, "purchase_recommendation"),
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
        { error: "We could not form a recommendation. Please try again." },
        { status: 502 },
      );
    }

    completionAttempted = true;
    const usage = await limiter.complete(reservation);
    reservation = null;

    return NextResponse.json({
      ...response.output_parsed,
      usage,
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Product analysis failed", error);

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
          error: CHECKS_UNAVAILABLE_ERROR,
          message: TEMPORARY_CHECKS_UNAVAILABLE_MESSAGE,
        },
        { status: 503 },
      );
    }

    if (error instanceof OpenAI.RateLimitError) {
      if (error.code === "insufficient_quota") {
        return NextResponse.json(
          {
            error:
              "OpenAI API billing is not active yet. Add billing or credits to this API project, then try again.",
          },
          { status: 402 },
        );
      }

      return NextResponse.json(
        { error: "We are handling a lot of decisions right now. Try again shortly." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "We could not analyze this product. Please try again." },
      { status: 500 },
    );
  }
}

function buildUserPrompt(
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

Return the requested structured recommendation.`;
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
