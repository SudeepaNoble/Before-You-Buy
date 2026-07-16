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

The app uses the visitor IP only on the server to enforce this limit. The raw
IP is never stored. Instead, the server salts and hashes the IP with
`RATE_LIMIT_SALT` before creating Redis keys.

Redis rate-limit keys expire automatically shortly after the UTC day ends. The
app keeps a small cleanup buffer so keys can disappear naturally even if a
visitor hits the limit close to midnight.

## Analytics

This app uses [Vercel Web Analytics](https://vercel.com/docs/analytics) for
privacy-conscious traffic analytics.

What it covers:

- page views
- approximate unique visitors
- referrers / traffic sources
- countries and regions where available
- browsers
- operating systems
- device types
- top pages

Custom product events tracked:

- `recommendation_started`
- `recommendation_completed`
- `recommendation_failed`
- `daily_limit_reached`
- `screenshot_selected`
- `product_url_added`
- `answers_completed`
- `result_reset`

Data intentionally not collected in analytics:

- raw IP addresses
- hashed IP addresses
- product URLs or hostnames
- uploaded screenshots or filenames
- product names
- exact prices
- OpenAI prompts or responses
- recommendation reasons
- `Future You Says`
- Redis keys or credentials
- API keys and salts

Unique visitors are approximate because the site does not require login and
Vercel aggregates anonymous visitor data.

### Where to view analytics

In Vercel:

1. Open the project dashboard.
2. Open **Analytics** in the sidebar.
3. Use the **Visitors** and **Pages** views for traffic and top routes.
4. Use the panel filters for referrers, countries, browsers, devices, and OS.
5. Open the **Events** view for custom funnel events.

According to Vercel’s official docs, custom events are available on Pro and
Enterprise plans. If the project is on a lower plan, page views and visitor
analytics can still work while custom events may not appear in the dashboard.

### How to enable analytics in Vercel

1. Open the Vercel project.
2. Go to **Analytics** in the sidebar.
3. Click **Enable**.
4. Redeploy the app after enabling analytics so the Vercel analytics routes are
   available in production.

No additional analytics environment variables are required for the Vercel
package integration in this app.

## Privacy page

The public privacy notice lives at `/privacy` and is linked from the footer.

## Deployment

Deploy the repository to Vercel and configure `OPENAI_API_KEY`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_SALT`.
The optional `OPENAI_MODEL` variable defaults to `gpt-5.4-mini`.

After adding or changing environment variables:

1. Save the variables in Vercel.
2. Redeploy the project.
3. Promote the latest deployment to production if needed.
