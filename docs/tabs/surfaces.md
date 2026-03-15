# Surfaces Tab Spec

Component directory: `src/components/surfaces/`

---

## Layout

Two-panel layout matching the chat tab pattern.

- **Main panel (left):** scrollable list of sector cards.
- **Detail sidebar (right, 384px / `w-96`):** appears when a sector is selected; shows hypothesis cards underpinning that sector's surface scores.

When no sector is selected the sidebar shows a short prompt: "Select a sector to see its hypotheses."

---

## Sector Cards

Each card shows:

1. **Header row:** sector label + status badge + quick-action menu (three-dot or icon row).
2. **Four surface bars** (need, buying_power, deliverability, incumbent_gap), stacked vertically inside the card.

### Surface bar visual (the most important UI element)

Each surface bar is a pair of overlapping horizontal bars on a 0-1 scale:

```
|=======-----------|  bet level (filled, muted colour)
|====--------------|  evidence level (filled, vivid/solid colour, overlaid on top)
         ^^^^         gap region (the exposed muted section between the two fills)
```

- The **evidence bar** sits on top of the **bet bar**. Both start from the left edge.
- The **gap** (bet minus evidence) is the exposed portion of the bet bar that pokes out beyond the evidence bar. This region must be visually distinct -- use a hatched/striped fill or a contrasting lower-opacity colour so it reads as "unproven conjecture" at a glance.
- Label each bar row with the surface name on the left and the numeric gap value on the right (e.g. `need  ·····  gap 0.23`).
- When gap is 0, hide the gap label. When gap > 0.3, add a warning tint (amber/red) to the gap region.

Use `ComputedSurface.betLevel`, `ComputedSurface.evidenceLevel`, and `ComputedSurface.gap` directly -- these come from `computeSurface()` in `src/lib/types.ts`.

### Status badges

Render as a small pill on the card header:

| Status | Colour | Text |
|---|---|---|
| conjecture | grey | conjecture |
| researching | blue | researching |
| testing | amber | testing |
| active | green | active |
| paused | muted/dim | paused |
| killed | red, strikethrough label | killed |

Type: `SectorStatus` from `src/lib/types.ts`.

### Quick actions

Buttons/icons visible on card hover or in an overflow menu:

- **Pause** -- sets status to `paused`. Available when status is `researching | testing | active`.
- **Kill** -- sets status to `killed`. Confirmation required (inline "are you sure?" or modal). Available when status is not already `killed`.
- **Reopen** -- sets status to `testing`. Available when status is `paused | killed`.

All fire `PATCH /api/sectors/[id]` with `{ status: "<new_status>" }`.

---

## Sorting

Toolbar above the card list with a sort dropdown:

| Option | Key | Default |
|---|---|---|
| Priority (default) | `betPriority()` aggregate across sector bets | yes |
| Gap size | sum or max of `ComputedSurface.gap` across four surfaces | |
| Name (A-Z) | `sector.label` | |

Use `betPriority()` from `src/lib/types.ts` for priority sort. Aggregate by summing priorities of all bets in the sector.

---

## Filtering

Toolbar filter controls (dropdowns or toggle chips):

1. **Surface type** -- show only sectors where a specific surface has gap > 0 (need, buying_power, deliverability, incumbent_gap). Multi-select.
2. **Conjecture vs evidence** -- filter to sectors where avg gap > threshold (heavy conjecture) or avg gap < threshold (evidence-grounded). Use `SURFACE_THRESHOLD` (0.4) from types.
3. **Sector status** -- multi-select on `SectorStatus`. Default: all except `killed`.

Filters are AND-combined.

---

## Detail Sidebar

Opens when a sector card is clicked. Shows:

### Sector header
- Sector label, full status badge, defining dimensions as key:value chips.

### Surface breakdown
For each of the four surfaces, a collapsible section:

**Section header:** surface name + bet level / evidence level / gap (same bar visual as the card, but wider).

**Section body:** list of hypothesis (bet) cards that contribute to this surface for the selected sector. A bet contributes if `bet.surfaceTarget === surfaceType || bet.secondarySurfaces.includes(surfaceType)` AND `bet.sectorIds.includes(sectorId)` -- this is the same filter `computeSurface()` uses.

Each hypothesis card shows:
- `claim` (text)
- Confidence bar: same overlapping-bar style (bet confidence vs evidence confidence)
- `updatePower` pill
- `isLoadBearing` flag (bolt icon or similar)
- `createdBy` label (dimmed)

Sort hypothesis cards within each section by `betPriority()` descending.

---

## Data Fetching

| Endpoint | Method | What it returns |
|---|---|---|
| `GET /api/dashboard` | GET | Array of `ComputedSurface` objects (all sectors x 4 surface types), plus sector metadata |
| `GET /api/sectors` | GET | Full sector list with CRUD fields |
| `PATCH /api/sectors/[id]` | PATCH | Update sector fields (status changes for quick actions) |

Fetch surfaces and sectors on mount. Refetch after any status mutation.

---

## Component Breakdown

```
src/components/surfaces/
  surfaces-panel.tsx       -- top-level component, manages state/fetch, renders toolbar + card list + sidebar
  sector-card.tsx          -- single sector card with surface bars and quick actions
  surface-bar.tsx          -- reusable overlapping bet/evidence bar
  status-badge.tsx         -- sector status pill (reusable across tabs)
  sector-sidebar.tsx       -- detail sidebar with hypothesis cards per surface
  hypothesis-card.tsx      -- single bet card in the sidebar
```

`surfaces-panel.tsx` is what `page.tsx` renders inside the `currentTab === "surfaces"` branch (replace the current `<p>surfaces view</p>` placeholder).

---

## Integration with page.tsx

In `src/app/page.tsx`, replace:

```tsx
{/* TODO: surfaces view */}
<p className="text-divider">surfaces view</p>
```

with:

```tsx
<SurfacesPanel />
```

Import from `@/components/surfaces/surfaces-panel`.

---

## Non-goals (for now)

- Composite/aggregate surface view toggle (spec mentions it; skip for hackathon).
- Sector dimension editing from this tab (use chat for now).
- Drag-and-drop reordering.
