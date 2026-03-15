# People / CRM Tab

## Purpose

Show every contact from discovery conversations, linked to the hypotheses their conversations informed. The signature feature is an Obsidian-style node graph visualizing the relationships between people, sectors, and bets.

---

## 1. Type Change Required

The `Conversation` interface in `src/lib/types.ts` is missing a contact name. Add:

```ts
export interface Conversation {
  id: string;
  contactName: string; // NEW - add this field
  rawNotes: string;
  companyCoordinates: Record<string, unknown>;
  contactRole: string | null;
  sectorIds: string[];
  createdAt: string;
  processed: boolean;
}
```

Update `POST /api/conversations` and any conversation-creation flows to accept and persist `contactName`.

---

## 2. Component Structure

All components live in `src/components/people/`. Suggested file layout:

```
src/components/people/
  PeopleTab.tsx          # top-level layout: graph + panels
  RelationshipGraph.tsx  # the force-directed graph
  ContactCard.tsx        # individual contact card
  ConversationLog.tsx    # conversation list with filters
  AddConversation.tsx    # modal/form for new conversation notes
```

Import `PeopleTab` in `src/app/page.tsx` and render it in the `people` tab slot (replacing the current TODO placeholder).

---

## 3. Relationship Graph (signature feature)

Use **react-force-graph-2d** (`react-force-graph`) for the interactive node graph. It wraps d3-force with a React API and renders on canvas for performance. Install: `bun add react-force-graph`.

### Node types

| Type | Visual | Data source |
|------|--------|-------------|
| **Person** | Circle, name label | `Conversation.contactName` + `contactRole` (deduplicate by name) |
| **Sector** | Hexagon or distinct colour | `Sector.label` via `Conversation.sectorIds` |
| **Bet** | Diamond or distinct colour | `Bet.claim` (truncated), only bets with linked evidence from conversations |

### Edge types

| Edge | Meaning | Derived from |
|------|---------|-------------|
| person --tested--> bet | This person's conversation produced evidence linked to this bet | `Evidence.sourceConversationId` -> `Bet.linkedEvidence[].evidenceId` |
| person --belongs_to--> sector | This person's conversation is tagged to this sector | `Conversation.sectorIds` |
| bet --informs--> sector | This bet targets this sector | `Bet.sectorIds` |

### Interactions

- **Hover** a node: highlight it and all connected edges/nodes, dim everything else.
- **Click** a node: open detail panel on the right (contact card for person, sector summary for sector, bet card for bet).
- **Toggle node types**: checkboxes at the top to show/hide people, sectors, bets independently.
- **Filter by sector**: dropdown to scope the graph to a single sector's subgraph.
- **Filter by processed status**: toggle to show only processed or unprocessed conversations' people.
- **Zoom/pan**: built-in with react-force-graph.

### Layout

The graph takes the left ~65% of the tab. The right ~35% is a detail/list panel that switches between contact card view and conversation log view.

---

## 4. Contact Cards

Displayed in the right panel when a person node is clicked or when browsing the contact list.

**Fields:**

- **Name**: `contactName`
- **Role**: `contactRole`
- **Company coordinates**: render `companyCoordinates` as key-value chips (e.g. `industry: quant finance`, `org_size: 200`)
- **Linked conversations**: list of conversations with this person (matched by `contactName`), each showing date and processed badge
- **Bets informed**: list of bets whose linked evidence traces back to this person's conversations. Show `bet.claim` (truncated) + the evidence direction (`supports` / `challenges`) + signal quality badge.

Keep cards compact. Expandable sections for conversations and bets.

---

## 5. Conversation Log

A scrollable list below or as an alternate view in the right panel.

**Each row shows:**

- Contact name + role
- Company coordinates (abbreviated)
- Date (`createdAt`)
- Status badge: `processed` (green) or `unprocessed` (amber)
- Raw notes preview (first ~100 chars, expandable)
- Linked evidence count
- Sector tags

**Filtering:**

- By sector (dropdown, multi-select)
- By status: processed / unprocessed / all
- By date range (simple date pickers)
- Free-text search over `contactName`, `contactRole`, `rawNotes`

**Sorting:** default by `createdAt` descending (newest first).

---

## 6. Adding Conversations

A button ("+ Add conversation") at the top of the conversation log, opening a form/modal.

**Form fields:**

- `contactName` (text, required)
- `contactRole` (text, optional)
- `companyCoordinates` (key-value pairs, add/remove rows, optional)
- `sectorIds` (multi-select from existing sectors, optional)
- `rawNotes` (textarea, required)

**On submit:**

1. `POST /api/conversations` with the form data. The API should create the conversation with `processed: false`.
2. The post-conversation agent (spec 3.4) triggers asynchronously to process the notes, extract evidence, propose bet updates.
3. The conversation appears in the log immediately as `unprocessed`. Once the agent finishes and the user reviews proposals, it flips to `processed`.

---

## 7. Data Fetching

- **Conversations**: `GET /api/conversations` -- returns `Conversation[]`
- **Sectors**: `GET /api/sectors` (already needed by other tabs) -- returns `Sector[]`
- **Bets + Evidence**: `GET /api/bets` and `GET /api/evidence` -- needed to build the graph edges from evidence back to conversations

Build the graph data client-side: join conversations to evidence (via `sourceConversationId`), evidence to bets (via `linkedEvidence`), conversations to sectors (via `sectorIds`), bets to sectors (via `sectorIds`).

---

## 8. Hackathon Scope & Priorities

1. **P0 -- Graph visualization**: get the force graph rendering with people, sectors, and bets as nodes with correct edges. This is the demo moment.
2. **P0 -- Add conversation form**: without this, no data enters the system through this tab.
3. **P1 -- Contact cards**: click a person node, see their details in the side panel.
4. **P1 -- Conversation log with filters**: browsable list with status/sector filtering.
5. **P2 -- Graph filtering toggles**: node type visibility, sector scoping.
6. **P2 -- Date range filtering**: nice to have, not critical for demo.

Start with the graph. Hardcode some mock data to get the visualization right, then wire up the API calls.
