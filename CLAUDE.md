AI-assisted GTM discovery system for identifying and validating beachhead customer segments.

## Tech stack

- **Framework:** Next.js (App Router, not Pages Router)
- **Language:** TypeScript
- **Runtime / package manager:** Bun
- **AI SDK:** Vercel AI SDK (`ai` package)
- **AI provider:** AWS Bedrock (Claude models via `@ai-sdk/amazon-bedrock`)
- **Agent pattern:** `createAgent()` wrapper around Vercel AI SDK's `ToolLoopAgent`
- **Auth:** Auth.js v5 (next-auth@beta) with GitHub OAuth, JWT sessions (no DB adapter)
- **Persistence:** lowdb (JSON file at `data/db.json`), singleton via `getDb()`

## Dev server

- Port is pinned to `3000` (see `src/lib/constants.ts`)
- OAuth callback URL: `http://localhost:3000/api/auth/callback/github`

## Env vars (`.env.local`)

- `AUTH_SECRET` — run `openssl rand -base64 32` to generate
- `AUTH_GITHUB_ID` — from GitHub OAuth App
- `AUTH_GITHUB_SECRET` — from GitHub OAuth App
- `AWS_REGION` — Bedrock region
- `AWS_BEARER_TOKEN_BEDROCK` — Bedrock API key

## Do not

- Commit credentials or `.env.local`
