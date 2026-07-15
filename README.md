# Before You Buy

A fast purchase-decision assistant. Upload a product screenshot or add a product
link, answer three questions, and receive a focused `BUY`, `WAIT`, or `SKIP`
recommendation.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add an OpenAI API key to `OPENAI_API_KEY`.
4. Add Upstash Redis credentials to `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
5. Add a long random `RATE_LIMIT_SALT` value. This is used server-side to hash
   visitor IP addresses before creating Redis keys.
6. Run `npm run dev`.

The app uses the Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI
primitives, Upstash Redis, and the OpenAI Responses API. It stores no
screenshots or user data and does not scrape product URLs.

## Daily recommendation limit

Each visitor can receive 2 completed recommendations per UTC calendar day.
Only successful recommendations count toward the daily limit; invalid forms,
unsupported images, oversized uploads, and upstream OpenAI failures do not
consume a check. The allowance resets at the next UTC midnight.

## Deployment

Deploy the repository to Vercel and configure `OPENAI_API_KEY`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_SALT`.
The optional `OPENAI_MODEL` variable defaults to `gpt-5.4-mini`.
