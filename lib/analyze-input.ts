import { answerSchema, type Answers } from "@/lib/analysis";

export const MAX_SCREENSHOT_SIZE = 8 * 1024 * 1024;
export const SUPPORTED_SCREENSHOT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ValidAnalyzeInput = {
  answers: Answers;
  productUrl: string;
  screenshot: File | null;
};

export type AnalyzeInputValidation =
  | { ok: true; input: ValidAnalyzeInput }
  | { ok: false; error: string; status: number };

export function validateAnalyzeFormData(formData: FormData): AnalyzeInputValidation {
  const rawScreenshot = formData.get("screenshot");
  const screenshot = rawScreenshot instanceof File ? rawScreenshot : null;
  const productUrl = String(formData.get("url") || "").trim();
  const rawAnswers = String(formData.get("answers") || "");

  if (!screenshot && !productUrl) {
    return {
      ok: false,
      error: "Add a screenshot or product link to continue.",
      status: 400,
    };
  }

  let answers: Answers;
  try {
    answers = answerSchema.parse(JSON.parse(rawAnswers));
  } catch {
    return {
      ok: false,
      error: "Please answer all three questions.",
      status: 400,
    };
  }

  if (productUrl) {
    try {
      const parsedUrl = new URL(productUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      return {
        ok: false,
        error: "Enter a valid http or https product link.",
        status: 400,
      };
    }
  }

  if (screenshot) {
    if (!SUPPORTED_SCREENSHOT_TYPES.has(screenshot.type)) {
      return {
        ok: false,
        error: "Upload a JPG, PNG, or WebP screenshot.",
        status: 415,
      };
    }

    if (screenshot.size > MAX_SCREENSHOT_SIZE) {
      return {
        ok: false,
        error: "The screenshot must be smaller than 8 MB.",
        status: 413,
      };
    }
  }

  return {
    ok: true,
    input: {
      answers,
      productUrl,
      screenshot,
    },
  };
}
