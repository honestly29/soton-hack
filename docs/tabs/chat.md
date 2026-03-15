# Chat Tab — Status and Roadmap

## What's built

### Frontend

**`src/components/chat-panel.tsx`** — single-file chat UI built on Vercel AI SDK's `useChat` hook.

- **Message stream:** `useChat` with `DefaultChatTransport` pointing at `/api/chat`. Renders `m.parts` (text only for now; tool-call parts are skipped with a TODO comment at line 379).
- **File upload:** drag-and-drop onto the whole panel, plus a menu button offering file or folder picker. Accepts `.pdf`, `.md`, `.txt`, `.docx`, `.pptx`. Folder drops recursively resolve via `webkitGetAsEntry`. Files accumulate as `PendingAttachment[]` chips below the message list.
- **GitHub URL detection:** pasting or typing a `github.com/owner/repo` URL auto-extracts the slug into a pending repo chip and strips the URL from the input.
- **Extraction flow:** on submit, pending files and repos are sent to `/api/extract` via FormData. The returned text blocks are prepended to the user message as `=== ATTACHED: name ===` blocks. The prefix is stripped from rendered messages so the user just sees their original text.
- **Status forwarding:** `onStatusChange` callback lets the parent know when the agent is streaming/idle.

**`src/components/chat-sidebar.tsx`** — PPR checklist sidebar.

- Reads `PPR_FIELDS` from `src/lib/types.ts` and groups them by tier (required / recommended / enrichment).
- Each field shows a status icon: `–` empty, `~` draft, checkmark confirmed.
- Clicking a field opens an inline textarea editor. Edits call `onFieldEdit` which hits `PUT /api/ppr` with `{ fields: { [key]: value } }`, setting status to `confirmed`.
- "Confirm all" button promotes every draft to confirmed and sets `pprConfirmed: true`.
- Footer shows `N/3 required` count and a "ready to confirm" badge once required fields are filled.

### API routes

**`POST /api/chat`** — streaming chat endpoint.

- Auth-gated via `auth()`.
- Uses `streamText` with the Bedrock Claude model and extended thinking (`budgetTokens: 4000`).
- System prompt is the Ingestion Copilot: extract PPR fields from uploaded material, then ask the user about remaining fields one at a time, required-first.
- Two tools:
  - `updatePPRField(field, value)` — writes a single PPR field to the lowdb store with status `draft`.
  - `getPPRProgress()` — returns all fields with status/value/tier, plus a summary with `readyForConjecture` flag.
- `stopWhen: stepCountIs(5)` caps tool-use loops.

**`POST /api/extract`** — file and repo text extraction.

- Auth-gated. Accepts FormData with repeatable `file` entries and a comma-separated `repos` string.
- Delegates to `extractFromFile` (buffer + filename) and `extractFromRepo` (owner, repo, access token) in `src/lib/ingest/extract`.
- Returns `{ sources: { name, text }[] }`.

**`GET|PUT /api/ppr`** — PPR CRUD.

- `GET` returns `{ ppr, pprConfirmed, pprProgress }`.
- `PUT` accepts `{ fields?: Partial<PPR>, confirm?: boolean }`. User-edited fields go straight to `confirmed` status. If `confirm: true`, all non-empty fields become confirmed and `pprConfirmed` is set.

### Types (`src/lib/types.ts`)

Defines the full domain model: `Evidence`, `Bet`, `Sector`, `Conversation`, `ComputedSurface`, `Proposal`, plus `PPR_FIELDS`, `PPRProgress`, surface/priority computation functions (`computeSurface`, `betPriority`). The types are ready; the API routes and tools that use them are not.

---

## What remains to build

### 1. Chat beyond ingestion

Right now the chat agent is only the Ingestion Copilot. After PPR is confirmed, it has no tools and no system prompt for the rest of the workflow. The chat route needs to detect workflow stage and swap system prompt + tools accordingly.

**New tools needed on `/api/chat`:**

| Tool | Purpose |
|------|---------|
| `getBets(sectorId?, surfaceType?)` | Query bets, filtered by sector/surface |
| `getSectors(status?)` | List sectors with computed surfaces |
| `getEvidence(betId?)` | Retrieve evidence, optionally scoped to a bet |
| `computeSurfaces(sectorId)` | Return the four surfaces for a sector |
| `proposeGraphMutation(type, data)` | Propose a bet update, new bet, new evidence, or sector refinement. Returns a proposal ID for HITL confirmation |

These map directly to the spec (section 3.5). Add them incrementally as each agent is built rather than all at once.

### 2. Pre-conversation prep

User says "I'm about to talk to [persona] at [company type]." The agent should:

- Match the persona/company coordinates to relevant sectors.
- Pull highest-priority bets (by `betPriority`) for those sectors.
- Identify the biggest gaps (high update power, low evidence confidence).
- Generate Mom Test-compliant discovery questions mapped to specific bets.

This is primarily a system prompt + `getBets`/`getSectors` tools problem. No new UI components needed beyond rendering the agent's response.

### 3. Post-conversation processing

User dumps notes into the chat. The agent should:

- Parse notes against existing bets and propose updates (direction, confidence shift, signal quality).
- Propose new bets for emergent signal.
- Propose sector boundary refinements.
- If notes are sparse, ask targeted follow-up questions.

Proposed updates should render as inline confirmation cards (see below).

### 4. Graph mutation proposals (inline confirmation cards)

The chat currently skips tool-call parts (line 379 TODO). When `proposeGraphMutation` is called, the response should render as a card with:

- Summary of the proposed change (bet update, new bet, new evidence, sector refinement).
- `[Confirm]` `[Adjust]` `[Reject]` buttons.
- Clicking Confirm calls a new `POST /api/proposals/confirm` endpoint that commits the mutation.

This requires:
- A `ProposalCard` component (the `Proposal` type already exists in `types.ts`).
- Rendering logic in `chat-panel.tsx` for `tool-call` message parts.
- A proposals API route for CRUD on pending proposals.

### 5. Strategic queries

"Which sector has the biggest gap on buying power?" The agent calls `computeSurfaces` across sectors and answers. This falls out naturally from adding the tools in item 1.

### 6. Dynamic sidebar

The sidebar currently only shows the PPR checklist. It should change based on workflow stage:

| Stage | Sidebar content |
|-------|----------------|
| Ingestion (PPR not confirmed) | PPR checklist (current behaviour) |
| Exploration (post-conjecture) | Sector overview — list of sectors with surface summaries |
| Conversation prep | Bet context — priority bets for the target sector, gaps to probe |
| Post-conversation | Proposed updates awaiting confirmation |

The parent component should pass a `stage` prop and render the appropriate sidebar. Consider extracting sidebar variants into `src/components/chat/sidebar-*.tsx`.

---

## Component structure

Everything currently lives in two files. As the above gets built, consider splitting into:

```
src/components/chat/
  chat-panel.tsx          -- message list + input (keep lean)
  chat-input.tsx          -- input bar, attachment chips, file pickers
  message-renderer.tsx    -- renders text, tool calls, proposal cards
  proposal-card.tsx       -- [Confirm] [Adjust] [Reject] inline card
  sidebar-ppr.tsx         -- current PPR checklist (extract from chat-sidebar.tsx)
  sidebar-sectors.tsx     -- sector overview for exploration stage
  sidebar-context.tsx     -- bet context for conversation prep
```

Don't split prematurely. Split when adding the proposal cards makes `chat-panel.tsx` unwieldy.

## API routes to build

| Route | Method | Purpose | Depends on |
|-------|--------|---------|------------|
| `/api/chat` | POST | Add new tools as agents are built | Each agent milestone |
| `/api/proposals` | GET/POST | List and create proposals | Graph mutation cards |
| `/api/proposals/[id]/confirm` | PUT | Accept/reject a proposal, commit mutation | Proposal cards |
| `/api/sectors` | GET | List sectors with computed surfaces | Exploration sidebar |
| `/api/bets` | GET | Query bets with filters | Conversation prep |

## Key things not to break

- The `useChat` transport and `sendMessage` flow work. Don't replace `useChat` with a custom implementation.
- The extraction flow (pending attachments -> `/api/extract` -> context prefix -> `sendMessage`) is solid. Keep the pattern of prepending extracted text as a context prefix.
- The `PPR_FIELDS` array in `types.ts` is the single source of truth for field definitions. Both the sidebar and the chat route reference it. Don't duplicate.
- The lowdb store (`getDb()`) is shared across routes. The PPR initialisation pattern (check for null, create default, write) is repeated in both `/api/chat` and `/api/ppr`. Consider extracting to a helper if adding more routes that touch PPR.
- `stopWhen: stepCountIs(5)` prevents runaway tool loops. Keep a similar guard as more tools are added.
