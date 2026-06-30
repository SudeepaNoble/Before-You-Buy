import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import {
  answerSchema,
  recommendationSchema,
  type Answers,
} from "@/lib/analysis";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "The recommendation service is not configured yet." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const screenshot = formData.get("screenshot");
    const productUrl = String(formData.get("url") || "").trim();
    const rawAnswers = String(formData.get("answers") || "");

    if (!(screenshot instanceof File) && !productUrl) {
      return NextResponse.json(
        { error: "Add a screenshot or product link to continue." },
        { status: 400 },
      );
    }

    let answers: Answers;
    try {
      answers = answerSchema.parse(JSON.parse(rawAnswers));
    } catch {
      return NextResponse.json(
        { error: "Please answer all three questions." },
        { status: 400 },
      );
    }

    if (productUrl) {
      try {
        const parsedUrl = new URL(productUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        return NextResponse.json(
          { error: "Enter a valid http or https product link." },
          { status: 400 },
        );
      }
    }

    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: "input_text",
        text: buildUserPrompt(answers, productUrl, screenshot instanceof File),
      },
    ];

    if (screenshot instanceof File) {
      if (!SUPPORTED_TYPES.has(screenshot.type)) {
        return NextResponse.json(
          { error: "Upload a JPG, PNG, or WebP screenshot." },
          { status: 415 },
        );
      }

      if (screenshot.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "The screenshot must be smaller than 8 MB." },
          { status: 413 },
        );
      }

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
      return NextResponse.json(
        { error: "We could not form a recommendation. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json(response.output_parsed, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Product analysis failed", error);

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
