# Before You Buy

A fast purchase-decision assistant. Upload a product screenshot or add a product
link, answer three questions, and receive a focused `BUY`, `WAIT`, or `SKIP`
recommendation.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add an OpenAI API key to `OPENAI_API_KEY`.
4. Run `npm run dev`.

The app uses the Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI
primitives, and the OpenAI Responses API. It stores no screenshots or user data
and does not scrape product URLs.

## Deployment

Deploy the repository to Vercel and configure `OPENAI_API_KEY`. The optional
`OPENAI_MODEL` variable defaults to `gpt-5.4-mini`.
