# Beachhead

AI-assisted Go-To-Market discovery system for identifying and validating beachhead customer segments.

Beachhead uses a multi-agent pipeline to help founders move from a vague product idea to a ranked, evidence-backed shortlist of customer segments worth pursuing. Upload your pitch deck or describe your product, and the system generates conjectures about potential beachhead markets, researches them with web evidence, and presents the results through interactive radar charts — with human-in-the-loop review at every stage.

## How it works

The system follows a three-stage workflow:

1. **Ingest** — Upload documents (PDF, DOCX, PPTX) or describe your product in chat. An ingestion agent extracts a structured Product–Problem Representation (PPR) covering pain, capabilities, persona, competitive landscape, and more.

2. **Conjecture** — Once the PPR is confirmed, a conjecture agent generates 5–8 candidate beachhead segments, each with defining dimensions and reasoning. These are surfaced as proposals for you to accept or reject before they enter the system.

3. **Explore** — A research agent takes accepted conjectures and runs web searches to gather evidence. It produces bets (testable claims about need, buying power, deliverability, and incumbent gaps) scored by confidence, update power, and testability difficulty.

## Key features

- **Multi-agent pipeline** — Specialised ingestion, conjecture, and research agents built on the Vercel AI SDK's `ToolLoopAgent` pattern with Claude on AWS Bedrock
- **Radar chart visualisations** — Four-surface radar charts (need, buying power, deliverability, incumbent gap) with dynamic scaling per sector
- **Human-in-the-loop proposals** — Agents propose changes (new bets, evidence, sector refinements) that require explicit acceptance before taking effect
- **Structured bet system** — Each bet tracks confidence vs. evidence confidence, update power, testability, validation plans, and linked evidence with direction (supports/challenges)
- **Multi-stage chat** — Conversational interface that adapts across ingest, conjecture, and explore stages with persistent message history
- **Document ingestion** — Parse pitch decks and product briefs from PDF, DOCX, and PPTX formats
- **Priority scoring** — Bets are automatically ranked by a priority function balancing update power, confidence gap, and testability

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Runtime | Bun (Node 22 LTS) |
| AI SDK | Vercel AI SDK v6 |
| AI Provider | AWS Bedrock (Claude Sonnet 4) |
| Auth | Auth.js v5 (GitHub OAuth, JWT sessions) |
| Database | lowdb (JSON file) |
| Charts | Recharts 3 |
| Styling | Tailwind CSS 4 |
| Document parsing | officeparser, unpdf |

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) installed
- Node 22 LTS (see `.nvmrc`)
- A GitHub OAuth App for authentication
- AWS Bedrock access with Claude models enabled

### Environment variables

Create a `.env.local` file in the project root:

```
AUTH_SECRET=          # run: openssl rand -base64 32
AUTH_GITHUB_ID=       # GitHub OAuth App client ID
AUTH_GITHUB_SECRET=   # GitHub OAuth App client secret
AWS_REGION=           # Bedrock region, e.g. us-east-1
AWS_BEARER_TOKEN_BEDROCK=  # Bedrock API key
```

### Install and run

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project structure

```
src/
├── app/
│   ├── api/              # API routes (chat, ingest, conjectures, bets, evidence, proposals, …)
│   ├── sign-in/          # Custom sign-in page
│   ├── page.tsx          # Main dashboard (tabbed UI)
│   └── layout.tsx        # Root layout with auth provider
├── components/
│   ├── chat-panel.tsx    # Multi-stage conversational interface
│   ├── surfaces-panel.tsx # Radar chart visualisations
│   ├── hypotheses-panel.tsx # Bet listing and priority ranking
│   ├── proposal-card.tsx # HITL accept/reject cards
│   └── …                # Sidebars, source input, tab bar
├── lib/
│   ├── agent.ts          # createAgent() wrapper around ToolLoopAgent
│   ├── agents/           # Ingestion, conjecture, and research agent definitions
│   ├── store/            # lowdb persistence layer
│   ├── tools/            # Agent tools (web search)
│   └── types.ts          # Core data model (sectors, bets, evidence, surfaces, proposals)
└── auth.ts               # Auth.js configuration
```

## Architecture

The agent system is built on a `createAgent()` wrapper that configures Vercel AI SDK's `ToolLoopAgent` with AWS Bedrock as the model provider. Each agent receives a structured prompt, a set of tools, and an output schema defined with Zod.

The core data model revolves around **sectors** (customer segments), **bets** (testable claims about a segment), and **evidence** (data points that support or challenge bets). Bets are scored across four **surfaces** — need, buying power, deliverability, and incumbent gap — which are visualised as radar charts on the dashboard.

All data is persisted to a local JSON file via lowdb, making the system fully self-contained with no external database dependencies.
