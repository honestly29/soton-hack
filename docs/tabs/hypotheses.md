# Hypotheses Tab (Quest Board)

Filterable/sortable card grid of bets. NOT a kanban. A pinned "tracking" section sits above the main grid.

## Component location

`src/components/hypotheses/`

---

## Data sources

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/bets` | GET | All bets. Supports query params: `sectorId`, `surface`, `minSignalQuality`, `minPriority`, `tracked`. Returns each bet with computed `priority` field. |
| `/api/proposals?status=pending` | GET | Pending agent proposals (type `new_bet`, `bet_update`). |
| `/api/proposals/[id]` | PATCH | Accept, adjust, or reject a proposal. Body: `{ status: "accepted" | "rejected", adjustments?: Partial<Bet> }` |

Priority is computed via `betPriority()` from `src/lib/types.ts`:

```ts
priority = (UPDATE_POWER[updatePower] * confidence * gap) / TESTABILITY_DIFFICULTY[testabilityDifficulty]
```

---

## Layout

```
+----------------------------------------------------------+
|  [filter bar: sector | surface | quality | priority | tracked]  |
+----------------------------------------------------------+
|  TRACKING (pinned bets)                                  |
|  [card] [card] [card]                                    |
+----------------------------------------------------------+
|  PROPOSALS (pending, if any)                             |
|  [proposal card] [proposal card]                         |
+----------------------------------------------------------+
|  ALL BETS (sorted by priority desc)                      |
|  [card] [card] [card] [card] ...                         |
+----------------------------------------------------------+
```

Three sections, in order:
1. **Tracking** -- bets the user has pinned. Only visible when >= 1 bet is tracked. Stored client-side (localStorage key: `trackedBetIds: string[]`).
2. **Proposals** -- pending proposals from agents. Only visible when >= 1 pending proposal exists.
3. **All bets** -- everything else, sorted by priority descending (highest-value-to-test floats to top).

---

## Bet card

Each card shows:

| Field | Source | Display |
|---|---|---|
| Claim | `bet.claim` | Primary text, truncated to 2 lines collapsed |
| Confidence (bet surface) | `bet.confidence` | 0-1 bar or percentage |
| Evidence confidence | `bet.evidenceConfidence` | Overlaid or adjacent bar, visually shows gap |
| Gap | `confidence - evidenceConfidence` | Derived, shown as the visible difference between the two bars |
| Update power | `bet.updatePower` | Badge: `low` / `moderate` / `high` / `very_high` |
| Testability difficulty | `bet.testabilityDifficulty` | Badge: `trivial` .. `very_hard` |
| Load-bearing | `bet.isLoadBearing` | Icon/flag, toggleable |
| Linked evidence count | `bet.linkedEvidence.length` | Number + icon |
| Sector tags | `bet.sectorIds` resolved to `sector.label` | Chips |
| Surface tags | `bet.surfaceTarget` + `bet.secondarySurfaces` | Chips: `need`, `buying_power`, `deliverability`, `incumbent_gap` |
| Priority | computed | Small label, top-right corner |

Visual priority: the confidence/evidence gap bars should be the most prominent element on the card (spec section 6.3). Use two overlapping bars or filled-vs-outlined treatment so the gap is immediately legible.

---

## Card interactions

### Expand
Click card to expand inline (or slide-out panel). Expanded view shows:
- Full claim text
- All linked evidence as a list. Each evidence item shows: `content` (truncated), `direction` (supports/challenges icon), `signalQuality` badge, `sourceType` badge.
- Click an evidence item to see full source (conversation notes or research finding).

### Quick actions (available on collapsed card)
- **Pin/unpin** -- toggle tracking. Adds/removes bet ID from `trackedBetIds` in localStorage.
- **Toggle load-bearing** -- PATCH to `/api/bets/[id]` with `{ isLoadBearing: !current }`.

### Actions in expanded view
- **Link evidence** -- open a picker to attach existing evidence to this bet. POST to `/api/bets/[id]/evidence` with `{ evidenceId, direction }`.
- **Create new bet** -- button in the filter bar area, opens a form for manual bet creation.

---

## Proposal cards

Pending proposals (from `GET /api/proposals?status=pending` where type is `new_bet` or `bet_update`) render as bet cards with a distinct visual treatment (border highlight or background tint).

Each proposal card has inline controls:
- **Accept** -- `PATCH /api/proposals/[id]` with `{ status: "accepted" }`. Optimistically add the bet to the grid.
- **Adjust** -- opens the proposal data in an editable form. On save: `PATCH /api/proposals/[id]` with `{ status: "accepted", adjustments: { ... } }`.
- **Reject** -- `PATCH /api/proposals/[id]` with `{ status: "rejected" }`. Remove from proposals section.

For `bet_update` proposals, show the current bet values alongside proposed changes (diff view).

---

## Filtering

Filter bar at the top. All filters are combinable (AND logic).

| Filter | Control | Values |
|---|---|---|
| Sector | Multi-select dropdown | All sectors from `/api/sectors` |
| Surface | Multi-select chips | `need`, `buying_power`, `deliverability`, `incumbent_gap` |
| Evidence quality | Slider or dropdown | Min signal quality of linked evidence: `near_zero` .. `highest` |
| Priority | Slider | Min priority threshold |
| Tracked | Toggle | Show only tracked bets |

Default state: no filters applied, sorted by priority descending.

---

## Sorting

Default sort: `betPriority()` descending. The tracking section always appears at the top regardless of sort. Within the tracking section, sort by priority too.

---

## Integration with page.tsx

The hypotheses tab is already stubbed in `src/app/page.tsx` (line 146-158). Replace the placeholder `<p>` with the hypotheses board component. The tab unlocks once PPR is confirmed (`hasSectors` flag).

---

## File structure

```
src/components/hypotheses/
  hypotheses-board.tsx    -- top-level component, owns fetch + filter state
  bet-card.tsx            -- single bet card (collapsed + expanded)
  proposal-card.tsx       -- proposal card with accept/adjust/reject
  filter-bar.tsx          -- filter controls
  tracking-section.tsx    -- pinned bets section
```
