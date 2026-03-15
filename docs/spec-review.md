# Spec Review Findings

Multi-agent review of `docs/spec.md` from three angles: completeness/gaps, codebase alignment, and internal consistency/domain soundness.

---

## Critical Gaps (must resolve before implementation)

### 1. Confidence value range is undefined

- `confidence` and `evidence_confidence` are `number` but no range is specified (0–1? 0–100?)
- The chat agent example (line 319) uses "0.6 to 0.8", implying 0–1, but this is never formalised
- Affects: every computation, agent outputs, UI display, human calibration

### 2. Priority formula has a type mismatch

- Formula: `bet_confidence * gap / testability_difficulty` (line 121)
- `testability_difficulty` is a qualitative enum (`trivial`/`easy`/`moderate`/`hard`/`very_hard`), not a number
- Same issue applies to `update_power` and `signal_quality` wherever they're used arithmetically
- **Needs:** explicit numeric mappings for all qualitative enums

### 3. `update_power` is absent from the priority formula

- `update_power` ("how much validating this bet would move the target surface") is the best proxy for "upside"
- Yet the formula uses raw `bet_confidence` as the upside term instead
- A bet with `very_high` update power and moderate gap should outrank a bet with `low` update power and large gap
- **Suggested fix:** `priority = update_power * bet_confidence * gap / testability_difficulty` or similar

### 4. Surface aggregation function is unspecified

- Surfaces are "aggregated from bets" (line 79/495) but the aggregation is never defined
- Mean? Weighted mean (by what)? Minimum (weakest link)? Maximum?
- Two implementations could produce entirely different sector rankings from the same data
- Same issue for sector-level priority (line 268): how is `testability_difficulty` aggregated across bets to the sector level?

### 5. Confidence update mechanics are only qualitative

- "The magnitude of the update is proportional to the signal quality and update power" (line 64)
- Both are qualitative enums — "proportional" requires numeric values
- What happens when evidence *invalidates* a bet? Does `evidence_confidence` decrease too, or only `confidence`?
- The spec only describes evidence_confidence rising (line 62), never falling

### 6. Surface threshold is undefined

- "A sector is only viable if all four surfaces are above threshold simultaneously" (line 84)
- Referenced in the sector kill workflow (5.4) as a trigger condition
- The threshold value, whether it's configurable, and whether it's the same across all four surfaces — all undefined

### 7. Persistence strategy has no decision

- Section 8.1 lists three options but makes no choice
- The codebase has zero database dependencies
- This determines the entire data access layer and is foundational

### 8. No API route design

- The spec describes agent pipelines and HITL gates but defines no API contracts
- How do files reach the server? How are agent results streamed? How do HITL confirmations work?
- The existing codebase has zero API routes

### 9. HITL staging mechanism is undesigned

- Where do proposed mutations live before the user approves them?
- Separate `pending` status in the graph? A staging table? Ephemeral state?
- The UI mechanics for batch review (30 sectors, 50–100 bets) are described philosophically but not mechanically

---

## High-Severity Issues (should resolve, won't block a first pass)

### 10. Sector lifecycle: `testing` → `active` transition undefined

- This is the beachhead selection decision — the most important transition in the system
- No workflow covers it, no threshold is specified, no HITL gate governs it

### 11. Desk research signal quality unaddressed

- The Mom Test heuristics are calibrated for conversational evidence
- No guidance on what signal quality desk research receives
- If auto-committed with no quality assessment, it could inflate evidence confidence

### 12. `Conversation.sector_id` is singular

- Contradicts "sectors are filters, not containers" — a conversation's company coordinates may fall in multiple sectors
- Should be `sector_ids: string[]` or derived from `company_coordinates`

### 13. Incumbent gap polarity is ambiguous

- High value = "there IS a gap" (good) or "incumbents ARE strong" (bad)?
- Consider renaming to `competitive_whitespace` or `market_openness`

---

## Medium-Severity Issues (real-world gaps, can defer for MVP)

### 14. No model for bet dependencies

- Real discovery has conditional bets: A is only meaningful if B holds
- `is_load_bearing` is binary and non-relational — doesn't say which other bets depend on it
- Could add `depends_on: bet_id[]` but adds complexity

### 15. No evidence conflict resolution workflow

- Two high-signal pieces of evidence on the same bet can contradict each other
- System can represent this but has no workflow for the founder to reason through it

### 16. No evidence staleness mechanism

- Evidence has `created_at` but no decay or staleness flagging
- In fast-moving markets, 6-month-old conversations may be irrelevant

### 17. No workflow for agents to propose new sectors

- Post-conversation agent can create new bets but cannot propose new sectors
- A conversation might reveal an entirely unconjectured customer segment

### 18. Missing surface: channel/access

- Can you actually *reach* these people? Not modelled as a strategic dimension
- `testability_difficulty` on individual bets partially captures this, but not at sector level

### 19. ProductProblemRepresentation has no versioning

- Workflow 5.7 requires tracking which PPR version produced which bets
- The data model has no `id`, `version`, or `created_at` on PPR

### 20. Confidence calibration is extremely hard for humans

- Adjusting 0.72 vs 0.68 is meaningless to founders
- Consider qualitative bands (very_high/high/moderate/low/very_low) matching the existing scales

---

## What's Already Strong (no changes needed)

- The three-object ontological model (Evidence, Bets, Sectors) is elegant and sufficient
- The two-surface framework (bet vs evidence, gap = epistemic risk) is the core innovation and well-specified
- Mom Test heuristics as first-class citizens in signal quality assessment
- Sectors-as-filters philosophy avoids propagation machinery and is conceptually sound
- HITL-everywhere principle is clearly motivated and consistently applied
- Workflow coverage is comprehensive (7 workflows covering the full discovery lifecycle)
- Scope exclusions (Part 9) are clear and well-reasoned
- Success criteria (Part 10) are concrete and measurable

---

## Codebase State

- ~5% of spec is implemented: source input UI + minimal Bedrock wrapper
- Tech stack is sound — no fundamental mismatches
- Next.js App Router, Vercel AI SDK, and Bedrock can support everything in the spec
- Missing: database, API routes, data model types, file parsing libraries, web search integration, all agents, all dashboard UI

---

## Recommended Next Steps

1. **Resolve the 9 critical gaps above** by amending `docs/spec.md` with concrete decisions:
   - Confidence range: 0–1
   - Numeric mappings for qualitative enums (e.g. trivial=1, easy=2, moderate=3, hard=4, very_hard=5)
   - Include `update_power` in the priority formula
   - Define surface aggregation as weighted mean by `update_power`
   - Define confidence update deltas (even simple ones)
   - Set a default surface threshold (e.g. 0.4) with configurable override
   - Choose persistence (recommend SQLite via Drizzle for hackathon scope)
   - Sketch API route structure
   - Define HITL staging as a `pending_proposals` table/queue

2. **Then** transform the amended spec into a phased implementation plan with clear milestones, critical path, and scope cuts for MVP

3. **Scope cuts for MVP/hackathon**: defer deep research agents (web search), sector splitting, product framing change workflow, voice integration, Google Drive — the system works without these
