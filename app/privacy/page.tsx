import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How Before You Buy handles analytics, uploads, rate limits, and privacy.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/75 p-6 shadow-[0_28px_90px_rgba(50,39,58,.09)] backdrop-blur-xl sm:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b7c91]">
          Privacy
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#2e2735] sm:text-4xl">
          A simple explanation of what we collect.
        </h1>

        <div className="mt-8 space-y-6 text-[14px] leading-7 text-[#5f5766] sm:text-[15px]">
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6e5679]">
              Anonymous usage analytics
            </h2>
            <p className="mt-2">
              We collect basic anonymous usage analytics like visits, approximate
              unique visitors, device type, general location, referrers, and
              feature usage. We use Vercel Web Analytics for this.
            </p>
            <p className="mt-2">
              We do not use advertising trackers, fingerprinting, or session
              recording. We also do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6e5679]">
              Uploads and product links
            </h2>
            <p className="mt-2">
              We do not store uploaded screenshots. We also do not store product
              links as analytics data.
            </p>
            <p className="mt-2">
              Uploaded content is sent to OpenAI only to generate the
              recommendation you asked for.
            </p>
          </section>

          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6e5679]">
              Daily recommendation limit
            </h2>
            <p className="mt-2">
              To enforce the two-checks-per-day limit, we use a privacy-safe
              network identifier created from your server-observed IP address.
              That identifier is salted and hashed on the server before it is used.
            </p>
            <p className="mt-2">
              We do not store the raw IP address, display it, or send the raw or
              hashed value to analytics. Rate-limit identifiers expire
              automatically shortly after the UTC day ends.
            </p>
          </section>

          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#6e5679]">
              Cookies and consent
            </h2>
            <p className="mt-2">
              This site currently uses Vercel&apos;s cookie-free analytics
              integration and does not show a cookie banner for analytics.
            </p>
            <p className="mt-2">
              Privacy requirements can still vary by jurisdiction, so if you are
              launching publicly you should confirm your legal obligations instead
              of assuming the same rule applies everywhere.
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-[#e7e1e9] pt-5 text-[12px] text-[#7d7483]">
          <Link
            className="underline-offset-2 transition hover:text-[#6e5679] hover:underline"
            href="/"
          >
            Back to Before You Buy
          </Link>
        </div>
      </div>
    </main>
  );
}
