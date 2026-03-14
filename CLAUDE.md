AI-assisted GTM discovery system for identifying and validating beachhead customer segments.

## Tech stack

- **Framework:** Next.js (App Router, not Pages Router)
- **Language:** TypeScript
- **Runtime / package manager:** Bun
- **AI SDK:** Vercel AI SDK (`ai` package)
- **AI provider:** AWS Bedrock (Claude models via `@ai-sdk/amazon-bedrock`)
- **Agent pattern:** Wrapper around Vercel AI SDK

## Do not

- Commit credentials or `.env.local`