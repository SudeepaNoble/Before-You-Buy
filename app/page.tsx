"use client";

import { track } from "@vercel/analytics";
import {
  ArrowRight,
  Check,
  ImagePlus,
  Link2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  classifyAnalyzeFailure,
  createHomePageAnalytics,
  mapScreenshotFileType,
} from "@/lib/analytics";
import type {
  Answers,
  RecommendationResponse,
  RecommendationUsage,
} from "@/lib/analysis";
import { cn } from "@/lib/utils";

const questions = [
  {
    key: "similar" as const,
    number: "01",
    title: "Do you own something similar?",
    options: ["No", "Yes", "Yes, but I want an upgrade"] as const,
  },
  {
    key: "wantedFor" as const,
    number: "02",
    title: "How long have you wanted it?",
    options: ["Just today", "About a week", "More than a month"] as const,
  },
  {
    key: "usage" as const,
    number: "03",
    title: "How often will you really use it?",
    options: ["Daily", "Weekly", "Monthly", "Rarely"] as const,
  },
];

const verdictStyles = {
  BUY: {
    accent: "#276957",
    soft: "#eaf5f0",
    border: "#c5dfd5",
    label: "Worth bringing home",
  },
  WAIT: {
    accent: "#926022",
    soft: "#fff5e4",
    border: "#ecd8ad",
    label: "Give it a little time",
  },
  SKIP: {
    accent: "#176b72",
    soft: "#e2f1ef",
    border: "#b8d9d5",
    label: "Your money has better plans",
  },
};

const scoreMeta = {
  dealQuality: { label: "Deal quality", goodWhenHigh: true },
  impulseRisk: { label: "Impulse risk", goodWhenHigh: false },
  practicalValue: { label: "Practical value", goodWhenHigh: true },
  regretRisk: { label: "Regret risk", goodWhenHigh: false },
} as const;

const DAILY_LIMIT_ERROR = "DAILY_LIMIT_REACHED";
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Before You Buy",
  applicationCategory: "ShoppingApplication",
  operatingSystem: "Web",
  description: "Think before you checkout.",
  url: "https://before-you-buy-ten.vercel.app/",
  creator: {
    "@type": "Person",
    name: "Sudeepa Kolli",
  },
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [usage, setUsage] = useState<RecommendationUsage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [limitNotice, setLimitNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [analytics] = useState(() =>
    createHomePageAnalytics((eventName, properties) => {
      track(eventName, properties);
    }),
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const allAnswered = questions.every((question) => answers[question.key]);
  const hasProduct = Boolean(file || productUrl.trim());
  const noChecksLeft = Boolean(limitNotice || usage?.remaining === 0);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  useEffect(() => {
    analytics.trackAnswersCompleted(answers);
  }, [analytics, answers]);

  function acceptFile(nextFile?: File) {
    setError("");
    if (!nextFile) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) {
      setError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (nextFile.size > 8 * 1024 * 1024) {
      setError("That image is over 8 MB. Please choose a smaller screenshot.");
      return;
    }

    setFile(nextFile);
    const fileType = mapScreenshotFileType(nextFile.type);
    if (fileType) {
      analytics.trackScreenshotSelected(fileType);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  function chooseAnswer(key: keyof Answers, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function handleProductUrlChange(url: string) {
    setProductUrl(url);
    analytics.trackProductUrlAdded(url);
  }

  async function analyzeProduct(event: FormEvent) {
    event.preventDefault();
    if (isLoading || noChecksLeft) return;

    const hasUrl = Boolean(productUrl.trim());
    let requestId: number | null = null;

    setError("");
    setLimitNotice(null);

    if (!hasProduct) {
      setError("Add a screenshot or product link to continue.");
      return;
    }

    if (!allAnswered) {
      setError("Choose one answer for each question.");
      return;
    }

    if (productUrl.trim()) {
      try {
        const parsedUrl = new URL(productUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        setError("Enter a complete product link, including https://");
        analytics.trackValidationFailure();
        return;
      }
    }

    requestId = analytics.beginRecommendation({
      answers: answers as Answers,
      hasScreenshot: Boolean(file),
      hasUrl,
    });

    setIsLoading(true);

    try {
      const formData = new FormData();
      if (file) formData.append("screenshot", file);
      if (productUrl.trim()) formData.append("url", productUrl.trim());
      formData.append("answers", JSON.stringify(answers));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.error === DAILY_LIMIT_ERROR) {
          setUsage({
            limit: data.limit,
            remaining: data.remaining,
            resetAt: data.resetAt,
          });
          setLimitNotice({
            title: "You’ve used your 2 checks for today.",
            message: "Come back tomorrow before your next checkout.",
          });
          analytics.trackDailyLimitReached(requestId);
          return;
        }

        analytics.failRecommendation(
          requestId,
          classifyAnalyzeFailure({
            code: typeof data.code === "string" ? data.code : null,
            status: response.status,
          }),
        );

        throw new Error(data.message || data.error || "We could not analyze this product.");
      }

      if (data.usage) setUsage(data.usage);
      setResult(data);
      analytics.completeRecommendation(requestId, {
        category: data.category,
        hasScreenshot: Boolean(file),
        hasUrl,
        usage: data.usage,
        verdict: data.verdict,
      });
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (requestError) {
      analytics.failRecommendation(requestId, "unknown");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function reset() {
    if (noChecksLeft) return;

    analytics.resetFlow();
    setFile(null);
    setProductUrl("");
    setAnswers({});
    setResult(null);
    setError("");
    setLimitNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="relative isolate min-h-screen">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Image
          alt=""
          className="object-cover"
          fill
          priority
          sizes="100vw"
          src="/AI_Bg_080.png"
        />
      </div>

      <header
        aria-hidden="true"
        className="mx-auto h-[66px] w-full max-w-6xl px-5 sm:h-[78px] sm:px-8"
      />

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-20 pt-10 sm:px-8 sm:pt-14 lg:grid-cols-[0.74fr_1.26fr] lg:gap-16 lg:pt-4">
        <Intro />

        <DecisionForm
          allAnswered={allAnswered}
          answers={answers}
          dragging={dragging}
          error={error}
          file={file}
          hasProduct={hasProduct}
          inputRef={inputRef}
          isLoading={isLoading}
          limitNotice={limitNotice}
          noChecksLeft={noChecksLeft}
          onAnswer={chooseAnswer}
          onDragChange={setDragging}
          onDrop={handleDrop}
          onFileChange={(event) => acceptFile(event.target.files?.[0])}
          onFileRemove={() => setFile(null)}
          onSubmit={analyzeProduct}
          preview={preview}
          productUrl={productUrl}
          setProductUrl={handleProductUrlChange}
        />
      </section>

      {result && (
        <ResultsStep
          onReset={reset}
          onResultReset={() => analytics.trackResultReset()}
          ref={resultRef}
          result={result}
        />
      )}

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-white/45 px-5 py-7 text-[11px] text-white/90 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>
          © Before You Buy · by{" "}
          <a
            className="text-inherit underline-offset-2 transition hover:text-white hover:underline"
            href="https://sudeepakolli.framer.website/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Sudeepa Kolli
          </a>
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>No affiliate links. No shopping agenda. Just a second opinion.</span>
          <Link
            className="underline-offset-2 transition hover:text-white hover:underline"
            href="/privacy"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}

function Intro() {
  return (
    <div className="lg:sticky lg:top-16 lg:self-center">
      <h1 className="font-editorial mt-6 max-w-lg text-[clamp(3.15rem,5.4vw,5rem)] leading-[0.91] tracking-[-0.06em] text-white drop-shadow-[0_2px_12px_rgba(0,30,35,.35)]">
        Before You
        <br />
        <span className="italic text-[#e4f58a]">Buy.</span>
      </h1>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#e5f2d5] drop-shadow-[0_1px_6px_rgba(0,30,35,.45)]">
        Less overthinking. Fewer regret buys.
      </p>
      <p className="mt-5 max-w-md text-[14px] leading-6 text-white/95 drop-shadow-[0_1px_7px_rgba(0,30,35,.5)] sm:text-[15px] sm:leading-7">
        Drop in what you&apos;re thinking of buying. Answer 3 quick questions. Get
        a buy, wait, or skip.
      </p>

    </div>
  );
}

type DecisionFormProps = {
  allAnswered: boolean;
  answers: Partial<Answers>;
  dragging: boolean;
  error: string;
  file: File | null;
  hasProduct: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  limitNotice: { title: string; message: string } | null;
  noChecksLeft: boolean;
  onAnswer: (key: keyof Answers, value: string) => void;
  onDragChange: (dragging: boolean) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFileRemove: () => void;
  onSubmit: (event: FormEvent) => void;
  preview: string;
  productUrl: string;
  setProductUrl: (url: string) => void;
};

function DecisionForm({
  allAnswered,
  answers,
  dragging,
  error,
  file,
  hasProduct,
  inputRef,
  isLoading,
  limitNotice,
  noChecksLeft,
  onAnswer,
  onDragChange,
  onDrop,
  onFileChange,
  onFileRemove,
  onSubmit,
  preview,
  productUrl,
  setProductUrl,
}: DecisionFormProps) {
  return (
    <form
      className="rounded-[1.75rem] border border-white/80 bg-white/72 p-4 shadow-[0_28px_90px_rgba(50,39,58,.11)] backdrop-blur-xl sm:p-6"
      onSubmit={onSubmit}
    >
      <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div
          aria-label={file ? "Change product screenshot" : "Upload product screenshot"}
          className={cn(
            "group relative flex min-h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#abd4d4] px-4 py-5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#277c83]",
            dragging
              ? "border-[#277c83] bg-[#cce8e7]"
              : "bg-[#e3f2f1] hover:border-[#5a9da0] hover:bg-[#d8eeec]",
          )}
          onClick={() => inputRef.current?.click()}
          onDragEnter={() => onDragChange(true)}
          onDragLeave={() => onDragChange(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {file && preview ? (
            <>
              <Image
                alt="Product screenshot preview"
                className="object-contain p-2"
                fill
                sizes="(max-width: 640px) 90vw, 300px"
                src={preview}
                unoptimized
              />
              <button
                aria-label="Remove screenshot"
                className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-lg bg-[#292334]/85 text-white shadow-md"
                onClick={(event) => {
                  event.stopPropagation();
                  onFileRemove();
                }}
                type="button"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c5e5e5] text-[#176b72] transition-transform group-hover:-translate-y-0.5">
                <UploadCloud size={19} strokeWidth={1.8} />
              </span>
              <span className="mt-3 text-[12px] font-semibold text-[#403646]">
                Add a screenshot
              </span>
              <span className="mt-1 text-[10px] leading-4 text-[#887e8e]">
                Drop or browse · max 8 MB
              </span>
              <span className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#176b72]">
                <ImagePlus size={12} />
                Choose image
              </span>
            </>
          )}
        </div>
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choose a product screenshot"
          className="hidden"
          onChange={onFileChange}
          ref={inputRef}
          type="file"
        />

        <div className="flex flex-col justify-center rounded-2xl border border-[#e8e2eb] bg-white/55 p-4">
          <span className="text-[9px] font-semibold lowercase tracking-[0.08em] text-[#a096a7]">
            or paste a link
          </span>
          <label className="relative mt-2.5 block">
            <Link2
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f9295]"
              size={13}
            />
            <input
              aria-label="Product link"
              className="h-10 w-full rounded-xl border border-[#c9dedd] bg-[#fbfdfc] pl-9 pr-3 text-[10px] text-[#302838] outline-none transition placeholder:text-[10px] placeholder:text-[#9caeae] focus:border-[#5a9da0] focus:ring-3 focus:ring-[#5a9da0]/15"
              onChange={(event) => setProductUrl(event.target.value)}
              placeholder="Paste a product link"
              type="url"
              value={productUrl}
            />
          </label>
          <p className="mt-2 text-[9px] leading-4 text-[#a39aa8]">
            Screenshots give the most useful recommendation.
          </p>
        </div>
      </div>

      <div className="my-6 h-px bg-[#e7e1e9]" />

      <div className="space-y-5">
        {questions.map((question) => (
          <fieldset key={question.key}>
            <legend className="flex w-full items-baseline gap-2.5">
              <span className="text-[13px] font-semibold tracking-[-0.015em] text-[#24585b]">
                {question.title}
              </span>
            </legend>
            <div
              className={cn(
                "mt-2 grid gap-1.5",
                question.options.length === 4
                  ? "grid-cols-2 sm:grid-cols-4"
                  : "grid-cols-1 sm:grid-cols-3",
              )}
            >
              {question.options.map((option) => {
                const selected = answers[question.key] === option;
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      "min-h-9 rounded-[10px] border px-2.5 py-1.5 text-[9px] font-medium leading-3.5 tracking-[0.005em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#277c83]",
                      selected
                        ? "border-[#277c83] bg-[#277c83] text-white shadow-sm"
                        : "border-[#d1e0df] bg-white/75 text-[#526b6c] hover:border-[#76adaf] hover:bg-white",
                    )}
                    onClick={() => onAnswer(question.key, option)}
                    type="button"
                    key={option}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error && (
        <p
          className="mt-5 rounded-xl bg-[#fbeef1] px-3 py-2.5 text-[11px] font-medium text-[#98485a]"
          role="alert"
        >
          {error}
        </p>
      )}

      {limitNotice && (
        <div
          className="mt-5 rounded-xl bg-[#fbeef1] px-3 py-2.5 text-[#98485a]"
          role="alert"
        >
          <p className="text-[11px] font-semibold">{limitNotice.title}</p>
          <p className="mt-1 text-[10px] leading-4">{limitNotice.message}</p>
        </div>
      )}

      <Button
        aria-label={
          isLoading
            ? "Analyzing your product"
            : noChecksLeft
              ? "Daily recommendation limit reached"
              : "Get your recommendation"
        }
        className="mt-6 w-full rounded-xl bg-[#176b72] text-[12px] tracking-[0.01em] hover:bg-[#125960] disabled:bg-[#9bc5c3] disabled:text-[#eaf7f4] disabled:opacity-100"
        disabled={!hasProduct || !allAnswered || isLoading || noChecksLeft}
        size="lg"
        type="submit"
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Analyzing whether it&apos;s worth it...
          </>
        ) : noChecksLeft ? (
          "Come back tomorrow"
        ) : (
          <>
            Get my recommendation
            <ArrowRight size={15} />
          </>
        )}
      </Button>

      <div className="mt-3 flex items-center justify-center gap-4 text-[9px] text-[#8b818f]">
        <span className="flex items-center gap-1">
          <LockKeyhole size={10} />
          No account needed
        </span>
        <span className="flex items-center gap-1">
          <ShieldCheck size={10} />
          Nothing stored
        </span>
      </div>
    </form>
  );
}

const ResultsStep = function ResultsStep({
  onReset,
  onResultReset,
  ref,
  result,
}: {
  onReset: () => void;
  onResultReset: () => void;
  ref: React.Ref<HTMLElement>;
  result: RecommendationResponse;
}) {
  const verdict = verdictStyles[result.verdict];
  const usageMessage =
    result.usage?.remaining === 1
      ? "1 check left today."
      : result.usage?.remaining === 0
        ? "That was your last check for today."
        : "";
  const verdictMessage = {
    BUY: "You'll probably use this enough to justify it.",
    WAIT: "You want it, but you don't need it today.",
    SKIP: "You probably don&apos;t need another one.",
  }[result.verdict];
  const nextStep = {
    BUY: "Looks like a purchase you'll actually use.",
    WAIT: "Come back in a week. If you still want it, that's a better signal.",
    SKIP: "Still thinking about it? Give it 7 days. If you still want it then, reconsider.",
  }[result.verdict];

  return (
    <section
      className="mx-auto w-full max-w-6xl scroll-mt-6 px-5 pb-24 sm:px-8"
      ref={ref}
    >
      <div className="mb-5 flex flex-col items-start justify-between gap-3 border-t border-[#ddd5df]/70 pt-12 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.045em] text-[#2e2735] sm:text-3xl">
            {result.productName || "Your product"}
          </h2>
          <p className="mt-1.5 text-[11px] text-[#776e7d]">
            {result.category || "General product"}
            {result.price && result.price !== "Not visible"
              ? ` · ${result.price}`
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {usageMessage && (
            <p className="text-[10px] font-medium text-[#7d7483]">
              {usageMessage}
            </p>
          )}
          {result.usage?.remaining !== 0 && (
            <Button
              onClick={() => {
                onResultReset();
                onReset();
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <RotateCcw size={13} />
              Try another
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <div
          className="relative overflow-hidden rounded-[1.75rem] border p-6"
          style={{ backgroundColor: verdict.soft, borderColor: verdict.border }}
        >
          <p
            className="text-[9px] font-extrabold uppercase tracking-[0.18em]"
            style={{ color: verdict.accent }}
          >
            The verdict
          </p>
          <p
            className="mt-2 text-6xl font-bold leading-none tracking-[-0.07em]"
            style={{ color: verdict.accent }}
          >
            {result.verdict}
          </p>
          <p className="mt-2 text-[12px] font-semibold text-[#554b5b]">
            {verdictMessage}
          </p>
          <div className="mt-7">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#857889]">
              Future you says
            </p>
            <p className="font-editorial mt-2 text-xl italic leading-7 text-[#342c3b]">
              “{result.futureYouSays}”
            </p>
          </div>
          <p className="mt-6 text-[10px] font-medium leading-4 text-[#625968]">
            {nextStep}
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-white/80 bg-white/72 p-5 shadow-[0_18px_55px_rgba(57,44,68,.07)] backdrop-blur sm:p-6">
          <h3 className="text-[15px] font-semibold tracking-[-0.025em] text-[#332b3a]">
            Why
          </h3>
          <ul className="mt-4 grid gap-3">
            {result.reasons.map((reason) => (
              <li
                className="flex gap-2.5 text-[11px] leading-5 text-[#625968]"
                key={reason}
              >
                <span
                  className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundColor: verdict.accent }}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
                <span>{formatReason(reason)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 grid grid-cols-4 gap-2 border-t border-[#e7e1e9] pt-4">
            {(Object.keys(scoreMeta) as Array<keyof typeof scoreMeta>).map(
              (key) => (
                <ScoreMetric
                  goodWhenHigh={scoreMeta[key].goodWhenHigh}
                  key={key}
                  label={scoreMeta[key].label}
                  value={key === "dealQuality" && result.price === "Not visible" ? null : result[key]}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

function formatReason(reason: string) {
  const [firstSentence, ...rest] = reason.split(/(?<=\.)\s+/);
  if (!rest.length) return reason;
  return (
    <>
      <strong className="font-semibold text-[#403746]">{firstSentence}</strong>{" "}
      <span className="text-[#817786]">{rest.join(" ")}</span>
    </>
  );
}

function ScoreMetric({
  goodWhenHigh,
  label,
  value,
}: {
  goodWhenHigh: boolean;
  label: string;
  value: number | null;
}) {
  if (value === null) {
    return (
      <div>
        <p className="text-[9px] font-medium text-[#817786]">{label}</p>
        <p className="mt-1 text-[12px] font-semibold text-[#817786]">—</p>
      </div>
    );
  }
  const isPositive = goodWhenHigh ? value >= 60 : value < 45;
  const isCaution = value >= 40 && value < 70;
  const color = isPositive ? "#357764" : isCaution ? "#a06c2f" : "#a34c60";

  return (
    <div>
      <div className="flex items-end justify-between gap-1">
        <p className="text-[9px] font-medium leading-3 text-[#817786]">{label}</p>
        <p className="text-[12px] font-semibold tracking-[-0.04em] text-[#554b5b]">
          {value}
        </p>
      </div>
      <Progress className="mt-2 h-1" indicatorColor={color} value={value} />
    </div>
  );
}
