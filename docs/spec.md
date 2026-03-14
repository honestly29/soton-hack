# GTM Discovery Copilot: Full System Specification

## What this document is

This is a comprehensive specification for a GTM (go-to-market) discovery copilot. It is a tool that helps founders systematically identify their ideal customer profile and beachhead market by structuring, prioritising, and partially automating the hypothesis testing process that underlies customer discovery.

The tool replaces the ad-hoc, intuition-driven process most founders follow (brainstorm sectors, google around, have unstructured conversations, lose signal) with a rigorous system grounded in Bayesian reasoning, structured hypothesis testing, and signal quality assessment.

This document should be treated as the authoritative design specification. Every architectural and conceptual decision described here has been made deliberately. Do not simplify the ontological model, do not collapse the two-surface framework into a single confidence score, and do not remove HITL gates. These are load-bearing design decisions, not suggestions.

---

## Part 1: The Ontological Model

The system has three core object types. Everything else is either derived from these or is a property on one of them. This minimalism is intentional — earlier iterations included separate objects for "observations," "assumptions," "kill conditions," and "dependencies," all of which were found to be either equivalent to one of these three types or derivable from them.

### 1.1 Evidence

Evidence is raw signal from the world. It is a fact or data point that has been collected, either through desk research or through human conversations.

**Properties:**
- `id`: unique identifier
- `content`: the actual finding, in natural language
- `source_type`: one of `desk_research` or `conversation`
- `source_conversation_id`: nullable, links to the conversation that produced this evidence
- `source_company_coordinates`: the position in company-space of the company this evidence relates to (see Sectors below). This is a set of dimension-value pairs, e.g. `{industry: "quantitative finance", org_size: 300, geography: "London", tech_stack: ["Jira", "GitHub"]}`
- `source_role`: nullable, the role of the person who provided this evidence (e.g. "eng manager", "CTO", "IC developer"). Relevant for credibility weighting.
- `signal_quality`: a qualitative assessment of the evidence strength, following The Mom Test heuristics:
  - `highest`: observed current spending, demonstrated commitment (signed contract, allocated budget)
  - `high`: described past behaviour, specific workarounds they have built, concrete operational pain with specifics
  - `medium`: described current problems in detail but without behavioural proof
  - `low`: stated intent, agreement that the problem exists, enthusiasm
  - `near_zero`: compliments about the concept, vague interest, "that sounds cool"
- `created_at`: timestamp
- `tags`: freeform tags for search/filter

Evidence is **global**. It is not scoped to a sector. An observation made in a quant eng conversation lives in a shared pool and can be linked to bets in any sector. This is a critical design decision — it enables cross-sector relevance without needing explicit propagation machinery.

### 1.2 Bets

A bet is a claim about the world that could be true or false. It has a confidence level that moves as evidence accumulates.

What was previously called an "assumption" is just a bet with zero evidence. What was previously called an "observation" (e.g. "quant culture prices cognitive output via PnL") is just evidence that existed before any conversations. This simplification resolves confusion about what gets updated when.

**Properties:**
- `id`: unique identifier
- `claim`: the claim, in natural language (e.g. "Quant eng middle managers lack trusted signal on individual cognitive output")
- `confidence`: a value representing current belief strength. This is the **bet surface** for this claim.
- `evidence_confidence`: a value representing how much of the confidence is grounded in actual evidence vs conjecture. This is the **evidence surface** for this claim. Always <= confidence.
- `gap`: derived, = `confidence - evidence_confidence`. This is the epistemic risk — the size of untested conjecture.
- `linked_evidence`: list of evidence IDs that inform this bet, each with a directional annotation (`supports` or `challenges`)
- `surface_target`: which of the four surfaces this bet primarily informs. One of `need`, `buying_power`, `deliverability`, `incumbent_gap`. A bet can inform multiple surfaces, but should have a primary.
- `secondary_surfaces`: list of other surfaces this bet partially informs
- `update_power`: how much validating or invalidating this bet would move the target surface(s). Qualitative: `very_high`, `high`, `moderate`, `low`. Example: "they would pay for a solution" = very_high on need + buying_power. "They use Jira" = low on deliverability.
- `testability_difficulty`: how hard it is for this specific founder/team to get evidence for this bet. Qualitative: `trivial` (desk research can resolve), `easy` (have warm intros), `moderate` (cold outreach needed), `hard` (sector is gated/private), `very_hard` (almost impossible to access).
- `is_load_bearing`: boolean. If true, invalidating this bet makes the parent hypothesis structurally void. When a load-bearing bet is invalidated, the system should flag for immediate reallocation of testing resources.
- `created_at`: timestamp
- `created_by`: one of `conjecture_agent`, `research_agent`, `post_conversation_agent`, `user`
- `sector_filter`: which sector cluster(s) this bet belongs to (see Sectors below). A bet can belong to multiple overlapping clusters.

**The update loop:** conversations produce evidence. Evidence is linked to bets. Each piece of evidence has a signal quality weight. When evidence is linked to a bet:
- If the evidence `supports` the bet, both `confidence` and `evidence_confidence` can increase (the evidence surface rises toward the bet surface)
- If the evidence `challenges` the bet, `confidence` should decrease (the bet surface drops toward the evidence surface)
- The magnitude of the update is proportional to the signal quality of the evidence and the update power of the bet

The exact mechanics of confidence updates can be simple — this is a founder tool, not a statistical inference engine. The human confirms every update. The system proposes, the human adjusts.

### 1.3 Surfaces

There are four surfaces, derived from the Crane Venture Partners framework for beachhead ICP identification:

1. **Need intensity**: how acutely does this sector feel the pain the product addresses?
2. **Buying power**: can the person who feels the pain actually move budget? This includes the buying chain (champion, economic buyer, technical buyer, user buyer) — but the buying chain is modelled as bets on this surface, not as a separate construct.
3. **Deliverability**: can the current product (as it exists or will exist in ~3 months) actually solve enough of their problem? Includes integration requirements, tech stack compatibility, customisation burden.
4. **Incumbent gap**: can they solve this with something they already have or can easily buy from an established vendor? Includes the build-vs-buy question.

Each surface has two values per sector:
- **Bet surface**: the aggregate confidence across all bets that inform this surface for this sector. This represents where we *think* reality is.
- **Evidence surface**: the aggregate evidence-backed confidence across those same bets. This represents where reality has been *confirmed*.
- **Gap**: the difference. This is the epistemic risk — pure conjecture that hasn't been grounded.

Surfaces are **computed, not stored directly**. They are aggregations over the bets that target them within a given sector filter. When bets update, surfaces recompute automatically.

A sector is only a viable beachhead candidate if all four surfaces are above threshold simultaneously. A sector scoring very high on need but low on deliverability is not viable.

### 1.4 Sectors (Company-Space Clusters)

This is a critical conceptual point. Sectors are **not** static categories picked from a list. They are regions in the high-dimensional space of all possible companies.

Companies exist in a space defined by dimensions like: industry, sub-vertical, company size (employees), company size (revenue), geography, tech stack, org structure, team sizes, regulatory environment, culture (build-vs-buy tendency), growth stage, recent growth trajectory, and others.

A sector is a cluster in this space — a region where you believe bets transfer. If a bet is true for one company in the cluster, it is likely true for others nearby.

**Properties of a sector:**
- `id`: unique identifier
- `label`: human-readable name (e.g. "mid-tier quant funds, London, 100-300 employees")
- `defining_dimensions`: the set of dimension-value ranges that define this cluster. e.g. `{industry: "quantitative finance", org_size: [100, 300], geography: ["London", "NYC"], eng_team_structure: "pod-based"}`. These are mutable — they refine as evidence accumulates.
- `status`: one of `conjecture` (proposed by AI, not yet researched), `researching` (deep research agents active), `testing` (conversations happening), `active` (validated beachhead), `paused`, `killed`
- `created_at`: timestamp

**Sectors are filters, not containers.** Bets and evidence live in the global space. Sectors are saved filter presets that group them by company-space proximity. When you refine a sector boundary (add or tighten a dimension), you are adjusting a filter, not moving objects between containers. This means:
- A bet can belong to multiple overlapping sectors
- Evidence doesn't need to be "propagated" between sectors — it's always global, and sectors just include it if it's relevant to their cluster region
- When a sector splits, it's just creating two new filters from one. The underlying data doesn't move.

**Sector refinement from conversations:** every conversation is with a person at a specific company. That company has coordinates in the space. Evidence from the conversation is tagged with those coordinates. Over time, you can see which regions of a sector's cluster actually have the pain and which don't. The sector boundary tightens around the dimensions that predict whether bets hold. This is not a separate operation from hypothesis testing — it's the same process. A conversation that invalidates a bet for a large company but validates it for a mid-size company has implicitly taught you that company size is a dimension that matters for this cluster.

The post-processing agent (see Agents below) should be able to propose sector boundary refinements alongside bet updates: "based on this conversation, the defining dimensions for this sector might need to include org_size < 300."

---

## Part 2: Prioritisation Logic

The optimal testing strategy is not "close the largest uncertainty gaps first." It must be weighted by upside. It is acceptable to be uncertain about a sector with low conjectured upside.

### 2.1 Priority formula

For any individual bet:

```
priority = bet_confidence (upside) * gap (uncertainty) / testability_difficulty (cost)
```

For a sector overall, priority is an aggregation of the priorities of its constituent bets.

High upside (high bet surface), high uncertainty (large gap), low cost (easy to test) = highest priority. This is the efficient frontier for discovery — maximum signal per unit of founder effort.

### 2.2 Why the initial conjecture matters

The conjecture phase sets the bet surface before any evidence exists. If the conjecture is badly calibrated (sectors ranked too high or too low), all early discovery effort is misallocated. The deep research agents' primary job is to calibrate the initial bet surface through desk research so the first human conversations go to the right places.

### 2.3 AI triage of testability

The research agents can reduce testability difficulty for certain bet types without human contact. "Do companies in this sector use Jira" is a bet an AI agent can partially validate through job postings, tech stack databases, GitHub activity. This shifts it from "need a conversation" (moderate-hard difficulty) to "need a desk research pass" (trivial difficulty). The AI triages what requires human signal versus what can be resolved through open-source intelligence, so humans only spend relationship capital on bets where conversations are the only way to get evidence.

---

## Part 3: The Agent Pipeline

The system is a pipeline of specialised agents. Each reads from the knowledge graph and writes back to it. All agents propose — humans confirm. Nothing is written to the graph without human approval (with the exception of desk research evidence, which can be auto-committed since it's verifiable public information).

### 3.1 Ingestion Agent

**Trigger:** user connects a data source (GitHub repo, docs folder, pitch deck, README, or free-text product description).

**Input:** raw product/company data.

**Output:** a structured **product-problem representation** stored in the knowledge graph:
- `pain_description`: what pain does this product solve?
- `capabilities`: what does the product actually do?
- `target_persona`: who experiences the pain?
- `conditions`: under what conditions does the pain arise?
- `infrastructure_requirements`: what needs to be true of the buyer's environment for the product to work? (tech stack, team size, process maturity, etc.)
- `current_state`: what exists today vs what is planned?

**HITL gate:** the user MUST review and can edit the product-problem representation before any downstream agents run. This is critical because this framing determines every sector hypothesis. If the ingestion agent interprets the product as "engineering productivity visibility" when the founder means "cognitive labour pricing," every downstream hypothesis is miscalibrated.

**Edge case — re-ingestion:** if the user edits the product-problem representation after downstream agents have already run, the system should flag which sectors and bets were derived from the changed framing and offer to regenerate them. It should not auto-regenerate — the user might want to keep some hypotheses that are still valid under the new framing.

### 3.2 Conjecture Agent

**Trigger:** product-problem representation is confirmed by user.

**Input:** the product-problem representation.

**Output:** a list of proposed sector clusters in company-space, each with:
- A label and defining dimensions
- Initial bets on all four surfaces with reasoning
- Initial confidence levels (these are pure conjecture — evidence surface is zero)

The conjecture agent should be comprehensive — it should propose every plausible sector, including non-obvious ones. It is better to propose 30 sectors and let the user prune than to propose 5 and miss the actual beachhead.

**HITL gate:** the user reviews the proposed sectors and selects which ones to research further. Unselected sectors are stored with status `conjecture` and can be activated later. This gate prevents runaway API costs on deep research for irrelevant sectors.

### 3.3 Deep Research Agents

**Trigger:** user approves sectors for research.

**Input:** sector cluster definitions + product-problem representation.

**Execution:** one research agent spawns per approved sector. Agents run in parallel.

**What they do:** pull open-source intelligence relevant to each sector:
- Firmographic data (how many companies match this cluster, typical size/structure)
- Job postings (what roles exist, what tools are mentioned, what problems are described)
- Tech stack data (what infrastructure is common in this sector)
- Competitor/incumbent landscape (what existing solutions address the pain)
- Industry reports, regulatory context, market trends
- Public case studies, blog posts, conference talks that reveal operational pain points

**Output per sector:**
- Evidence nodes added to the global pool (tagged with source_type=desk_research)
- Proposed bets with initial confidence levels informed by the research
- Updated sector defining dimensions if research reveals relevant segmentation variables
- A narrative summary of findings for human consumption

**HITL consideration:** desk research evidence can be auto-committed to the graph since it's verifiable. But proposed bets should be reviewed by the user before being committed, especially load-bearing bets and confidence levels, since the research agent may over- or under-weight findings.

### 3.4 Post-Conversation Processing Agent

**Trigger:** user submits conversation notes (text input, pasted notes, or voice transcription).

**Input:** raw conversation notes + the current state of the knowledge graph (relevant bets, sector context).

**Output:** a structured set of proposed updates:

1. **Bet updates**: for each existing bet that the conversation touched:
   - Which bet
   - Direction: `supports` or `challenges`
   - Proposed confidence shift with reasoning
   - Signal quality assessment of the specific evidence, using Mom Test heuristics
   - The evidence node to be created

2. **New bets**: for emergent signal that doesn't map to any existing bet:
   - Proposed claim
   - Initial confidence
   - Which surface(s) it informs
   - The evidence that prompted it

3. **Sector boundary refinements**: if the conversation revealed that a dimension matters for sector segmentation:
   - Which sector
   - Which dimension
   - Proposed refinement

4. **Sparse notes flag**: if the notes are too sparse to meaningfully update any bets, the agent should ask targeted follow-up questions: "you were testing bet X — did anything in the conversation relate to this?"

**Critical design constraint — Mom Test signal quality heuristics:** this agent MUST have explicit heuristics for signal quality assessment baked into its system prompt. Without them, the default behaviour of language models is to treat enthusiastic language as strong signal, which is exactly the trap The Mom Test warns against. The heuristics:
- Someone describing a specific spreadsheet/tool/process they built to work around the problem = `high` signal
- Someone describing current spending on a related solution = `highest` signal
- Someone saying "yeah we'd definitely buy that" = `low` signal (stated intent, not behaviour)
- Someone saying "that sounds really interesting" = `near_zero` signal (compliment, not commitment)
- Someone describing a specific past event where the problem cost them time/money = `high` signal
- Someone agreeing with your description of the problem = `low` signal (leading question confirmation bias)

**HITL gate:** all proposed updates are presented to the user for review. The user can accept, adjust, or reject each one. Nothing is committed to the graph without confirmation. This is the most important HITL gate in the system because this is where signal quality judgment matters most.

### 3.5 Chat Agent

**Trigger:** user opens the chat tab and types or speaks.

**Input:** user message + full read access to the knowledge graph.

**Capabilities:**
- **Pre-conversation prep:** user says "I'm about to talk to an eng manager at a 200-person quant fund." The agent pulls relevant sector context, identifies which bets are highest priority to test given the persona and company coordinates, and generates Mom Test-compliant discovery questions. It also surfaces what the biggest gaps are — the bets with the highest update power that have the least evidence — so the user knows what to steer the conversation toward.
- **Post-conversation processing:** user dumps notes. The agent performs the same function as the Post-Conversation Processing Agent (3.4) but through a conversational interface. It can ask clarifying questions in real time, which is better for sparse notes.
- **Strategic queries:** user asks "which sector has the biggest gap on buying power right now" or "what's my strongest beachhead candidate." The agent queries the graph and answers.
- **Graph mutations:** any proposed changes to the graph (new bets, confidence updates, sector refinements) follow the same HITL confirmation pattern as the other agents.

**Scope:** the chat is global, not scoped to a sector. Sectors are filters on a shared space, so the chat operates over everything. Users can ask sector-specific questions ("tell me about quant eng") or cross-sector questions ("compare need intensity across my top 3 sectors") and the agent handles both.

**Voice integration (future):** ElevenLabs integration for voice input/output. User walks out of a meeting, talks through what happened, agent transcribes and processes. Text interface first, voice as a later addition.

---

## Part 4: The Dashboard

Three tabs. Two of them (surfaces and hypotheses) are different zoom levels on the same underlying data. The third (chat) is a conversational interface to the same data.

### 4.1 Surfaces Tab (Strategic View)

This is the default view when you open the tool. It answers: "where am I and where should I focus today?"

**What it shows:**
- All active sectors (status != `killed`) displayed as cards or rows
- For each sector, the four surfaces (need, buying power, deliverability, incumbent gap) shown visually
- Each surface displays both the **bet level** and the **evidence level** so the gap is visible. This is the single most important UI element in the entire system. The gap between bet and evidence is the epistemic risk, and it must be visually intuitive.
- Sectors are ordered by the priority formula: bet_surface (upside) * gap (uncertainty) / testability_difficulty (cost)
- Sector status badges (conjecture, researching, testing, active, paused, killed)
- Sector defining dimensions visible (so you can see what "quant eng" actually means in terms of company-space boundaries)

**Interactions:**
- Click a sector to drill into its hypothesis board
- Toggle between individual surfaces and a composite view
- Filter sectors by status
- Quick actions: pause sector, kill sector (with confirmation), reopen killed sector

**Visual design consideration:** the bet/evidence gap needs to be the most visually prominent element. Consider two overlapping bars, a filled-vs-outlined treatment, or a gauge metaphor where the bet level is the needle and the evidence level is a filled region. Whatever the implementation, the gap must be immediately legible at a glance across many sectors simultaneously.

### 4.2 Hypotheses Tab (Tactical View)

This is where you go once you've chosen a sector (or are looking at everything). It answers: "what should my next conversation try to learn?"

**What it shows:**
- All bets, optionally filtered by sector, by surface, by evidence quality, or by priority
- Each bet displayed as a card showing:
  - The claim (natural language)
  - Current confidence level (bet surface)
  - Evidence-backed confidence (evidence surface)
  - Gap size
  - Update power
  - Testability difficulty
  - Load-bearing flag
  - Count of linked evidence
  - Signal quality distribution of linked evidence (how much is high quality vs low quality)
  - Which sector(s) it belongs to
  - Which surface(s) it informs
- Default sort: priority (upside * gap / difficulty), so the highest-value-to-test bets float to the top
- Evidence nodes visible when expanding a bet card (the underlying data supporting or challenging the claim)

**Interactions:**
- Expand a bet to see linked evidence
- Click evidence to see source (conversation notes, research finding)
- Quick action: mark a bet as load-bearing
- Quick action: link existing evidence to a bet
- Quick action: create a new bet manually
- Filter by: sector, surface, evidence quality, priority, status
- When sector filters are applied, the view essentially becomes "the hypothesis board for this sector"

**Design consideration:** the default view (no filters) shows everything. This is intentional — sectors are filters, not containers. The user should be able to see the full landscape and apply filters to focus. The most useful default sort is by priority because it immediately surfaces where to spend effort.

### 4.3 Chat Tab (Conversational Interface)

See section 3.5 (Chat Agent) for functional specification.

**UI:**
- Standard chat interface (message input, conversation thread)
- Text input initially, voice input as future addition
- The chat agent can reference and link to specific bets, evidence, and sectors in its responses, and these references should be interactive (clicking them navigates to the relevant item in the surfaces or hypotheses tab)
- The chat can trigger graph mutations, which are presented as inline confirmation cards within the chat (e.g. "I propose updating bet X confidence from 0.6 to 0.8 based on this evidence. [Confirm] [Adjust] [Reject]")

---

## Part 5: Workflows

### 5.1 Workflow: Cold Start

1. User connects data source (GitHub repo, docs, pitch deck)
2. Ingestion agent produces product-problem representation
3. **HITL gate:** user reviews and edits the representation
4. Conjecture agent proposes sector clusters with initial bets
5. **HITL gate:** user prunes sectors, selects which to research
6. Deep research agents spawn per approved sector
7. Evidence enters global pool, bets are proposed with initial confidence
8. **HITL gate:** user reviews proposed bets (especially load-bearing and confidence levels)
9. Surfaces compute. Priority ranking appears on the dashboard.
10. User sees the landscape: which sectors look promising, where the gaps are, what to test first.

### 5.2 Workflow: Pre-Conversation Prep

1. User selects a hypothesis to test (from priority ranking) or tells the chat "I'm about to talk to [persona] at [company type]"
2. System generates pre-brief:
   - Sector context from desk research
   - Specific bets being tested, ranked by update power
   - The biggest gaps: bets with high update power and low evidence
   - Mom Test-compliant discovery questions mapped to each bet
   - What we DON'T know (the largest gaps on the highest-value surfaces)
3. User goes into conversation equipped with clear objectives but not a rigid script

### 5.3 Workflow: Post-Conversation Processing

1. User feeds conversation notes into the system (chat tab, or dedicated upload)
2. Post-processing agent proposes:
   - Bet updates (which bets touched, direction, confidence shift, signal quality)
   - New bets (emergent signal)
   - Sector boundary refinements (if dimensional insights emerged)
3. If notes are sparse, agent asks targeted follow-up questions
4. **HITL gate:** user reviews all proposed updates, confirms/adjusts/rejects each
5. Evidence enters global pool. Bets update. Surfaces recompute. Priority reshuffles.
6. Dashboard reflects new state immediately.

### 5.4 Workflow: Sector Kill Decision

1. Evidence accumulates over multiple conversations. The gap between bet and evidence surfaces closes. Evidence surface is consistently low.
2. System flags: "this sector's surfaces are consistently below threshold across [N] conversations. Consider killing."
3. System checks sampling coverage: have conversations covered the full cluster, or concentrated in one region? If concentrated, warns about sampling bias and identifies unsampled regions.
4. System checks pending commitments: any scheduled conversations where relationship cost is already spent?
5. **HITL gate:** user makes the kill decision.
6. Sector status changes to `killed`. It drops from priority ranking. All data (bets, evidence) is preserved. Sector can be reopened later if new evidence surfaces.

### 5.5 Workflow: Sector Refinement / Splitting

1. User has multiple conversations tagged to the same sector. Evidence creates a bimodal distribution along some dimension (e.g. company size).
2. System detects (or user notices) that the sector should be refined.
3. Two options presented:
   - **Narrow:** tighten the cluster to exclude the non-fitting region (e.g. remove companies >500 employees from the sector definition)
   - **Split:** create a new sector for the excluded region if it has its own distinct hypothesis set (e.g. "large quant funds" becomes a separate sector with different bets)
4. After narrowing or splitting, existing evidence re-sorts via the updated filters. Surfaces recompute per sub-sector.

### 5.6 Workflow: Sector Reopening

1. A killed or paused sector receives new cross-sector evidence (e.g. a conversation in fintech surfaces relevant signal for quant eng)
2. System surfaces: "there's new evidence potentially relevant to [killed sector]"
3. User decides whether to reopen
4. If reopened, sector status reverts to `testing`. All historical data is intact. New evidence is linked. Surfaces recompute incorporating the new evidence.

### 5.7 Workflow: Product Framing Change

1. User realises the product-problem representation needs updating (e.g. after conversations reveal the pain is different from initial assumptions)
2. User edits the product-problem representation
3. System flags which sectors and bets were derived from the original framing
4. User decides per-sector whether to regenerate (re-run conjecture + research) or keep existing hypotheses
5. Regenerated sectors go back through the standard pipeline

---

## Part 6: Key Design Principles

### 6.1 HITL (Human-in-the-Loop) is Non-Negotiable

Every graph mutation that involves judgment (confidence levels, signal quality, bet creation, sector boundaries) requires human confirmation. The AI proposes, the human decides. The system is a copilot, not an autopilot.

The only exception: desk research evidence (verifiable public facts) can be auto-committed. But even desk-research-derived bets require human confirmation.

### 6.2 Mom Test Heuristics are First-Class

The Mom Test (Rob Fitzpatrick) is a foundational reference for this system. Its core principle: signal quality varies enormously, and the default human (and AI) instinct is to overweight enthusiasm and stated intent. The system must actively correct for this.

Signal quality assessment is not an afterthought — it is baked into the post-processing agent's core logic. Every piece of conversational evidence must be assessed against the Mom Test heuristics before it can update a bet.

Key heuristics:
- Ask about their life and problems, not your idea
- Extract past behaviour, not future hypotheticals
- Compliments and interest are not signal
- Only specifics about past actions, current spending, and demonstrated pain are valid high-quality signal
- If they haven't already tried to solve the problem, it might not actually be a high-priority problem

### 6.3 The Two-Surface Framework is the Core Innovation

The separation of bet surface (where we think reality is) from evidence surface (where reality is confirmed) is the most important conceptual contribution of this system. The gap between them is the epistemic risk — pure untested conjecture.

This must be visually prominent in the UI. Every surface display, every bet card, every sector summary should make the gap visible. This is what prevents founders from confusing conviction with evidence.

### 6.4 Sectors are Filters, Not Containers

Bets and evidence live in a global space. Sectors are saved filter presets that group them by proximity in company-space. This means:
- No propagation machinery needed between sectors
- Bets can belong to multiple overlapping sectors
- Sector refinement is a filter adjustment, not a data migration
- Killing a sector preserves all data

### 6.5 Priority = Upside * Gap / Difficulty

Test the things that would matter most if true, that you're most uncertain about, and that are cheapest to test. This is the efficient frontier for discovery — maximum signal per unit of founder effort.

---

## Part 7: Data Model Summary

```
ProductProblemRepresentation
  pain_description: string
  capabilities: string
  target_persona: string
  conditions: string
  infrastructure_requirements: string
  current_state: string

Evidence
  id: string
  content: string
  source_type: "desk_research" | "conversation"
  source_conversation_id: string?
  source_company_coordinates: Map<string, any>
  source_role: string?
  signal_quality: "highest" | "high" | "medium" | "low" | "near_zero"
  created_at: timestamp
  tags: string[]

Bet
  id: string
  claim: string
  confidence: number
  evidence_confidence: number
  gap: number (derived: confidence - evidence_confidence)
  linked_evidence: Array<{evidence_id, direction: "supports" | "challenges"}>
  surface_target: "need" | "buying_power" | "deliverability" | "incumbent_gap"
  secondary_surfaces: string[]
  update_power: "very_high" | "high" | "moderate" | "low"
  testability_difficulty: "trivial" | "easy" | "moderate" | "hard" | "very_hard"
  is_load_bearing: boolean
  created_at: timestamp
  created_by: "conjecture_agent" | "research_agent" | "post_conversation_agent" | "user"
  sector_filters: string[] (sector IDs)

Sector
  id: string
  label: string
  defining_dimensions: Map<string, any>
  status: "conjecture" | "researching" | "testing" | "active" | "paused" | "killed"
  created_at: timestamp

Conversation
  id: string
  raw_notes: string
  company_coordinates: Map<string, any>
  contact_role: string?
  sector_id: string?
  created_at: timestamp
  processed: boolean

Surface (computed, not stored)
  sector_id: string
  surface_type: "need" | "buying_power" | "deliverability" | "incumbent_gap"
  bet_level: number (aggregated from bets targeting this surface within this sector)
  evidence_level: number (aggregated from evidence-backed confidence of those bets)
  gap: number (derived: bet_level - evidence_level)
```

---

## Part 8: Technical Considerations

### 8.1 Knowledge Graph Storage

The conceptual model is a graph — evidence nodes linked to bet nodes linked to sector filters, with surfaces computed from traversals. Implementation options:
- A graph database (Neo4j, etc.) if the team has experience and the query patterns warrant it
- A well-structured relational or document store with explicit foreign keys. The relationships are not complex enough to strictly require a graph DB. The key queries are: "all bets in sector X targeting surface Y," "all evidence linked to bet Z," "all bets with gap > threshold sorted by priority." These are all achievable with standard queries.
- The conceptual model should be a graph regardless of storage implementation.

### 8.2 Agent Architecture

Each agent (ingestion, conjecture, research, post-conversation, chat) is a distinct LLM call with a specific system prompt and access to relevant portions of the knowledge graph. They do not need to be different models — they are the same model with different prompts and context.

The research agents need web search / browsing capabilities.

The chat agent needs full read access to the graph and the ability to propose writes (subject to HITL confirmation).

### 8.3 Voice Integration

ElevenLabs integration for voice input/output on the chat tab. This is a polish feature — the text interface achieves the same functionality. Prioritise text first.

### 8.4 Data Source Integrations

For the ingestion agent, the system should support:
- GitHub repo connection (read README, docs, code structure)
- Document upload (pitch deck, one-pager, product spec)
- Free-text input (user describes the product)

For the research agents, the system needs:
- Web search capability
- Ability to read and extract from web pages (job postings, company websites, industry reports)

### 8.5 Agentic Memory

The knowledge graph IS the memory. All agents read from and write to the same graph. There is no separate "memory" system — the graph is the single source of truth. This ensures consistency: what the chat agent knows is exactly what the dashboard shows.

If using an LLM-native memory system (e.g. for the chat agent maintaining conversational context), it should be a cache layer on top of the graph, not a replacement for it. The graph is authoritative.

---

## Part 9: What the System Does NOT Do

Clarity on scope is as important as clarity on features.

- **The system does not automate outreach.** No cold emails, no LinkedIn automation, no email sequences. The system identifies who to talk to and what to ask. The human does the talking. Outreach tooling is commodity and operationally complex (deliverability, domain warming, compliance). It is a distraction from the intelligence layer.
- **The system does not make strategic decisions.** It surfaces data. "Which pain do we build for first" when two sectors look promising for different reasons is a founder judgment call that depends on team capability, technical architecture, fundraising narrative, and factors the model doesn't encode. The system presents the data clearly enough that these decisions are obvious; it does not make them.
- **The system does not score or rank individual companies.** It operates at the sector/cluster level. Individual company targeting is a downstream activity the founder does once a beachhead sector is identified.
- **The system does not replace conversations.** Desk research sets the bet surface. Only conversations move the evidence surface. The system is designed to make every conversation higher signal, not to avoid having them.

---

## Part 10: Success Criteria

The system is successful if a founder using it can:

1. Go from "I have a product, I don't know who to sell to" to "I have 3-5 prioritised sector hypotheses with specific bets to test" in a single session (cold start workflow)
2. Walk into every discovery conversation knowing exactly which bets to test and how to frame questions that produce high-quality signal
3. Walk out of every conversation and process their notes into structured bet updates in under 10 minutes
4. See, at a glance, which sectors are grounded in evidence vs pure conjecture
5. Make the kill/continue/narrow decision on a sector with clear data rather than gut feel
6. Never lose signal from a conversation because it sat unprocessed in a notes doc

The system is NOT successful if:
- The data entry burden is high enough that the founder stops using it after the first few conversations
- The AI agents produce low-quality hypotheses that need extensive manual correction
- The HITL gates become bottlenecks that slow down the discovery process
- The dashboard is complex enough to require training to use
