"use client";

import {
  ArrowRight,
  Check,
  ImagePlus,
  Link2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import Image from "next/image";
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
    accent: "#974657",
    soft: "#fbeef1",
    border: "#ebc8d0",
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

export default function HomePage() {
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

  async function analyzeProduct(event: FormEvent) {
    event.preventDefault();
    if (isLoading || noChecksLeft) return;

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
        return;
      }
    }

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
          return;
        }

        throw new Error(data.message || data.error || "We could not analyze this product.");
      }

      if (data.usage) setUsage(data.usage);
      setResult(data);
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (requestError) {
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

    setFile(null);
    setProductUrl("");
    setAnswers({});
    setResult(null);
    setError("");
    setLimitNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-32 h-80 w-80 rounded-full bg-[#e7dced]/45 blur-3xl" />
        <div className="absolute -right-28 top-0 h-96 w-96 rounded-full bg-[#f7e4d7]/55 blur-3xl" />
      </div>

      <Header onReset={reset} />

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
          setProductUrl={setProductUrl}
        />
      </section>

      {result && (
        <ResultsStep onReset={reset} ref={resultRef} result={result} />
      )}

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-[#ddd5df]/70 px-5 py-7 text-[11px] text-[#7d7483] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>
          © Before You Buy · by{" "}
          <a
            className="text-inherit underline-offset-2 transition hover:text-[#6e5679] hover:underline"
            href="https://sudeepakolli.framer.website/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Sudeepa Kolli
          </a>
        </span>
        <span>No affiliate links. No shopping agenda. Just a second opinion.</span>
      </footer>
    </main>
  );
}

function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center px-5 py-5 sm:px-8 sm:py-6">
      <button
        aria-label="Go to start"
        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f537e]"
        onClick={onReset}
      >
        <span className="text-[13px] font-semibold tracking-[-0.015em] text-[#2d2634]">
          Before You Buy
        </span>
      </button>
    </header>
  );
}

function Intro() {
  return (
    <div className="lg:sticky lg:top-16 lg:self-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#ded4e3] bg-white/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e5679] backdrop-blur">
        <Sparkles size={12} />
        Make the pause count
      </div>
      <h1 className="font-editorial mt-6 max-w-lg text-[clamp(3.15rem,5.4vw,5rem)] leading-[0.91] tracking-[-0.06em] text-[#28212f]">
        Before You
        <br />
        <span className="italic text-[#765c80]">Buy.</span>
      </h1>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8b768f]">
        A clearer answer before checkout
      </p>
      <p className="mt-5 max-w-md text-[14px] leading-6 text-[#675e6c] sm:text-[15px] sm:leading-7">
        Upload what caught your eye, answer three honest questions, and get a
        clear buy, wait, or skip recommendation in seconds.
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
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b7c91]">
            Your purchase check
          </p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.025em] text-[#302838]">
            Let&apos;s look at this clearly.
          </h2>
        </div>
        <span className="rounded-full bg-[#f0eaf3] px-2.5 py-1 text-[10px] font-semibold text-[#71597d]">
          ≈ 15 sec
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
        <div
          aria-label={file ? "Change product screenshot" : "Upload product screenshot"}
          className={cn(
            "group relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-4 py-5 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#745882]",
            dragging
              ? "border-[#785b85] bg-[#f3edf6]"
              : "border-[#cfc4d4] bg-[#faf8fb] hover:border-[#9f88a9] hover:bg-[#f7f2f8]",
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
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ece3f0] text-[#73527f] transition-transform group-hover:-translate-y-0.5">
                <UploadCloud size={19} strokeWidth={1.8} />
              </span>
              <span className="mt-3 text-[12px] font-semibold text-[#403646]">
                Add a screenshot
              </span>
              <span className="mt-1 text-[10px] leading-4 text-[#887e8e]">
                Drop or browse · max 8 MB
              </span>
              <span className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#71577c]">
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

        <div className="flex flex-col justify-center rounded-2xl border border-[#e3dde6] bg-white/80 p-4">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#918697]">
            Or use a link
          </span>
          <label className="relative mt-2.5 block">
            <Link2
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f8296]"
              size={13}
            />
            <input
              aria-label="Product link"
              className="h-10 w-full rounded-xl border border-[#ddd6e1] bg-[#fcfbfc] pl-9 pr-3 text-[10px] text-[#302838] outline-none transition placeholder:text-[10px] placeholder:text-[#aaa1ad] focus:border-[#92749f] focus:ring-3 focus:ring-[#92749f]/10"
              onChange={(event) => setProductUrl(event.target.value)}
              placeholder="Paste a product link"
              type="url"
              value={productUrl}
            />
          </label>
          <p className="mt-2 text-[9px] leading-4 text-[#908696]">
            Screenshots give the most useful recommendation.
          </p>
        </div>
      </div>

      <div className="my-6 h-px bg-[#e7e1e9]" />

      <div className="space-y-5">
        {questions.map((question) => (
          <fieldset key={question.key}>
            <legend className="flex w-full items-baseline gap-2.5">
              <span className="text-[9px] font-bold tracking-[0.12em] text-[#9a82a4]">
                {question.number}
              </span>
              <span className="text-[13px] font-semibold tracking-[-0.015em] text-[#403746]">
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
                      "min-h-9 rounded-[10px] border px-2.5 py-1.5 text-[9px] font-medium leading-3.5 tracking-[0.005em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#745882]",
                      selected
                        ? "border-[#6f527b] bg-[#6f527b] text-white shadow-sm"
                        : "border-[#ded7e1] bg-white/75 text-[#665d6c] hover:border-[#aa96b2] hover:bg-white",
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
        className="mt-6 w-full rounded-xl bg-[#2b2432] text-[12px] tracking-[0.01em] hover:bg-[#3c3144]"
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
  ref,
  result,
}: {
  onReset: () => void;
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

  return (
    <section
      className="mx-auto w-full max-w-6xl scroll-mt-6 px-5 pb-24 sm:px-8"
      ref={ref}
    >
      <div className="mb-5 flex flex-col items-start justify-between gap-3 border-t border-[#ddd5df]/70 pt-12 sm:flex-row sm:items-end">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#8c7c92]">
            Your recommendation
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-[#2e2735] sm:text-3xl">
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
            <Button onClick={onReset} size="sm" type="button" variant="outline">
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
            {verdict.label}
          </p>
          <div className="mt-7 rounded-2xl border border-white/70 bg-white/55 p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#857889]">
              Future you says
            </p>
            <p className="font-editorial mt-2 text-xl italic leading-7 text-[#342c3b]">
              “{result.futureYouSays}”
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/80 bg-white/72 p-5 shadow-[0_18px_55px_rgba(57,44,68,.07)] backdrop-blur sm:p-6">
          <h3 className="text-[15px] font-semibold tracking-[-0.025em] text-[#332b3a]">
            Why this recommendation
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
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(scoreMeta) as Array<keyof typeof scoreMeta>).map(
              (key) => (
                <ScoreCard
                  goodWhenHigh={scoreMeta[key].goodWhenHigh}
                  key={key}
                  label={scoreMeta[key].label}
                  value={result[key]}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

function ScoreCard({
  goodWhenHigh,
  label,
  value,
}: {
  goodWhenHigh: boolean;
  label: string;
  value: number;
}) {
  const isPositive = goodWhenHigh ? value >= 60 : value < 45;
  const isCaution = value >= 40 && value < 70;
  const color = isPositive ? "#357764" : isCaution ? "#a06c2f" : "#a34c60";

  return (
    <div className="rounded-xl border border-[#e7e1e9] bg-[#fcfbfc] p-3">
      <div className="flex items-end justify-between gap-2">
        <p className="text-[9px] font-medium leading-3 text-[#716776]">{label}</p>
        <p className="text-base font-bold tracking-[-0.04em] text-[#332b3a]">
          {value}
        </p>
      </div>
      <Progress className="mt-2 h-1.5" indicatorColor={color} value={value} />
    </div>
  );
}
