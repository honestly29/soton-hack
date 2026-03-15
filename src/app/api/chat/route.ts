import { streamText, tool, convertToModelMessages, stepCountIs, generateText } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { model } from "@/lib/agent";
import { getDb } from "@/lib/store";
import { PPR_FIELDS, type ProductProblemRepresentation, type PPRProgress } from "@/lib/types";
import { generateConjectures } from "@/lib/agents/conjecture";
import { deepResearch } from "@/lib/agents/research";

// ---------------------------------------------------------------------------
// Stage detection
// ---------------------------------------------------------------------------

type Stage = "ingestion" | "conjecture" | "exploration";

async function detectStage(): Promise<Stage> {
  const db = await getDb();

  if (!db.data.pprConfirmed) return "ingestion";
  if (db.data.bets.length === 0) return "conjecture";
  return "exploration";
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const INGESTION_PROMPT = `You are the Ingestion Copilot for a GTM (Go-To-Market) Discovery system.

Your job is to help the user define their Product-Problem Representation (PPR) — a structured profile that captures what their product does, who it helps, and why it matters.

## Workflow

1. **On your very first message**, call \`getPPRProgress\` to see what fields are already filled.
2. If the user has provided uploaded material (documents, repo contents, etc.), carefully extract every PPR field you can from that material. Call \`updatePPRField\` for each field you can confidently fill.
3. After processing any material, review remaining empty fields and ask the user about them **one question at a time**, starting with required fields before moving to recommended and enrichment fields.

## Field tiers (in priority order)

**Required** (must be filled before conjecture can run):
- painDescription — What pain does this solve?
- capabilities — What does the product do?
- targetPersona — Who experiences this pain?

**Recommended** (improves conjecture quality):
- conditions — When does the pain arise?
- infrastructureRequirements — Buyer environment requirements?
- currentState — What exists today vs planned?

**Enrichment** (improves sector targeting):
- competitiveLandscape — Existing solutions / competitors?
- pricingModel — Pricing model?
- founderAdvantage — Founder's unique advantage?
- geographicContext — Target markets / regulations?

## Guidelines

- Be conversational but focused — you are a copilot, not a chatbot.
- When you extract a field from material, briefly explain what you found and why you filled it that way.
- Ask only one question at a time. Keep questions concise and targeted.
- If the user's answer covers multiple fields, update all of them.
- When all required fields are filled, let the user know they can proceed to conjecture, but offer to fill recommended/enrichment fields too.
- Never invent information. Only fill fields based on what the user or their materials explicitly state.`;

const CONJECTURE_PROMPT = `You are the Conjecture Copilot for a GTM Discovery system.

The user has completed their Product-Problem Representation. Your job is to help them generate and review beachhead customer segment hypotheses.

## Workflow

1. First call \`generateConjectures\` to create sector hypotheses from the PPR (or return existing ones if already generated).
2. Present each conjecture clearly — sector label, key dimensions, and reasoning.
3. Help the user review each conjecture. Use \`reviewConjecture\` to accept or reject each one.
4. When the user wants to run deep research, call \`runDeepResearch\` with NO arguments — this automatically researches ALL accepted conjectures. Do NOT ask for IDs. Just call the tool.
5. You can call \`getAcceptedConjectures\` to see which conjectures are accepted.

## IMPORTANT
- When the user says "run deep research" or similar, IMMEDIATELY call \`runDeepResearch({})\` — do NOT ask for IDs or clarification.
- \`runDeepResearch\` with no conjectureId will automatically process all accepted conjectures.

## Guidelines

- Explain each conjecture in plain language — don't just dump JSON.
- Help the user understand why each sector was selected and what makes it promising.
- After research completes, summarize the key bets and evidence found.
- Be proactive but not pushy. Let the user drive the pace.`;

const EXPLORATION_PROMPT = `You are the Exploration Copilot for a GTM Discovery system.

The user has generated sector hypotheses and run research. Your job is to help them explore, validate, and refine their bets.

## Available actions

- View sectors and bets across different surfaces (need, buying_power, deliverability, incumbent_gap)
- Examine evidence supporting or challenging specific bets
- Generate validation plans for high-priority bets
- Prepare for customer discovery interviews
- Process interview notes to extract new evidence and update bets

## Guidelines

- Help the user prioritize which bets to validate first (high update_power, low testability_difficulty)
- When showing bets, highlight the confidence gap (confidence vs evidenceConfidence) — bigger gaps mean more validation needed.
- Be analytical and structured in your responses.
- When processing interview notes, be thorough in extracting evidence and suggest bet updates.`;

// ---------------------------------------------------------------------------
// Tool sets
// ---------------------------------------------------------------------------

function ingestionTools() {
  return {
    updatePPRField: tool({
      description:
        "Update a single field of the Product-Problem Representation in the database.",
      inputSchema: z.object({
        field: z.enum([
          "painDescription",
          "capabilities",
          "targetPersona",
          "conditions",
          "infrastructureRequirements",
          "currentState",
          "competitiveLandscape",
          "pricingModel",
          "founderAdvantage",
          "geographicContext",
        ]),
        value: z.string().describe("The content to store for this field."),
      }),
      execute: async ({ field, value }) => {
        const db = await getDb();

        if (!db.data.ppr) {
          db.data.ppr = {
            painDescription: "",
            capabilities: "",
            targetPersona: "",
            conditions: "",
            infrastructureRequirements: "",
            currentState: "",
            competitiveLandscape: "",
            pricingModel: "",
            founderAdvantage: "",
            geographicContext: "",
          };
        }

        if (!db.data.pprProgress) {
          db.data.pprProgress = {} as PPRProgress;
          for (const f of PPR_FIELDS) {
            db.data.pprProgress[f.key] = "empty";
          }
        }

        db.data.ppr[field] = value;
        db.data.pprProgress[field] = "draft";
        await db.write();

        return { success: true, field, status: "draft" as const };
      },
    }),

    getPPRProgress: tool({
      description:
        "Retrieve the current PPR and its field-level progress.",
      inputSchema: z.object({}),
      execute: async () => {
        const db = await getDb();

        const ppr = db.data.ppr;
        const progress = db.data.pprProgress;

        const fields = PPR_FIELDS.map((f) => ({
          key: f.key,
          label: f.label,
          tier: f.tier,
          status: progress?.[f.key] ?? "empty",
          value: ppr?.[f.key] ?? "",
        }));

        const filledCount = fields.filter((f) => f.value.length > 0).length;
        const requiredFilled = fields.filter(
          (f) => f.tier === "required" && f.value.length > 0,
        ).length;
        const requiredTotal = fields.filter((f) => f.tier === "required").length;

        return {
          fields,
          summary: {
            filled: filledCount,
            total: fields.length,
            requiredFilled,
            requiredTotal,
            readyForConjecture: requiredFilled === requiredTotal,
          },
        };
      },
    }),
  };
}

function conjectureTools() {
  return {
    generateConjectures: tool({
      description:
        "Generate beachhead customer segment hypotheses based on the PPR. Returns conjectures with sector labels for review.",
      inputSchema: z.object({}),
      execute: async () => {
        // Return existing conjectures if already generated
        const db = await getDb();
        if (db.data.conjectures.length > 0) {
          const existingSectors = db.data.sectors;
          const existingProposals = db.data.proposals.filter(p => p.type === "new_conjecture");
          return {
            success: true,
            count: db.data.conjectures.length,
            conjectures: db.data.conjectures.map((c) => {
              const sector = existingSectors.find(s => s.id === c.sectorId);
              const proposal = existingProposals.find(p => (p.data as Record<string, unknown>)?.conjectureId === c.id);
              return {
                conjectureId: c.id,
                sectorLabel: sector?.label ?? c.summary,
                definingDimensions: sector?.definingDimensions ?? {},
                summary: c.summary,
                reasoning: c.reasoning,
                status: c.status,
                proposalId: proposal?.id ?? c.id,
              };
            }),
          };
        }
        const { sectors, conjectures, proposals } = await generateConjectures();
        return {
          success: true,
          count: conjectures.length,
          conjectures: conjectures.map((c, i) => ({
            conjectureId: c.id,
            sectorLabel: sectors[i].label,
            definingDimensions: sectors[i].definingDimensions,
            summary: c.summary,
            reasoning: c.reasoning,
            status: c.status,
            proposalId: proposals[i].id,
          })),
        };
      },
    }),

    reviewConjecture: tool({
      description:
        "Accept or reject a conjecture. Updates both the conjecture and its matching proposal.",
      inputSchema: z.object({
        conjectureId: z.string().describe("The ID of the conjecture to review"),
        action: z.enum(["accept", "reject"]).describe("Whether to accept or reject this conjecture"),
      }),
      execute: async ({ conjectureId, action }) => {
        const db = await getDb();
        const conjecture = db.data.conjectures.find((c) => c.id === conjectureId);
        if (!conjecture) return { success: false, error: "Conjecture not found" };

        const newStatus = action === "accept" ? "accepted" : "rejected";
        conjecture.status = newStatus;

        // Update matching proposal
        const proposal = db.data.proposals.find(
          (p) => p.type === "new_conjecture" && (p.data as { conjectureId: string }).conjectureId === conjectureId,
        );
        if (proposal) {
          proposal.status = action === "accept" ? "accepted" : "rejected";
        }

        // Update sector status if accepted
        if (action === "accept") {
          const sector = db.data.sectors.find((s) => s.id === conjecture.sectorId);
          if (sector) sector.status = "researching";
        }

        await db.write();
        return { success: true, conjectureId, status: newStatus };
      },
    }),

    getAcceptedConjectures: tool({
      description: "Get all accepted conjectures with their IDs and sector labels. Call this before running deep research.",
      inputSchema: z.object({}),
      execute: async () => {
        const db = await getDb();
        const accepted = db.data.conjectures.filter((c) => c.status === "accepted");
        return {
          conjectures: accepted.map((c) => {
            const sector = db.data.sectors.find((s) => s.id === c.sectorId);
            return { conjectureId: c.id, sectorLabel: sector?.label ?? c.summary, status: c.status };
          }),
        };
      },
    }),

    runDeepResearch: tool({
      description:
        "Run deep research on accepted conjectures. Pass a specific conjectureId, or omit it to research ALL accepted conjectures.",
      inputSchema: z.object({
        conjectureId: z.string().optional().describe("The ID of a specific conjecture to research. Omit to research all accepted conjectures."),
      }),
      execute: async ({ conjectureId }) => {
        const db = await getDb();
        const ppr = db.data.ppr;
        if (!ppr) return { success: false, error: "PPR not found" };

        // Determine which conjectures to research
        const targets = conjectureId
          ? db.data.conjectures.filter((c) => c.id === conjectureId && c.status === "accepted")
          : db.data.conjectures.filter((c) => c.status === "accepted");

        if (targets.length === 0) return { success: false, error: "No accepted conjectures to research" };

        const results = [];
        for (const conjecture of targets) {
          const sector = db.data.sectors.find((s) => s.id === conjecture.sectorId);
          if (!sector) continue;

          const { bets, evidence } = await deepResearch(ppr, sector, conjecture);
          db.data.bets.push(...bets);
          db.data.evidence.push(...evidence);
          conjecture.status = "researched";
          results.push({ sectorLabel: sector.label, betsGenerated: bets.length, evidenceGenerated: evidence.length });
        }

        await db.write();

        return {
          success: true,
          researchedCount: results.length,
          results,
          totalBets: db.data.bets.length,
          totalEvidence: db.data.evidence.length,
          summary: results.map((r) => `${r.sectorLabel}: ${r.betsGenerated} bets, ${r.evidenceGenerated} evidence`).join("; "),
        };
      },
    }),
  };
}

function explorationTools() {
  return {
    getBets: tool({
      description: "Get bets, optionally filtered by sector or tracked status.",
      inputSchema: z.object({
        sectorId: z.string().optional().describe("Filter bets by sector ID"),
        tracked: z.boolean().optional().describe("Filter by tracked status"),
      }),
      execute: async ({ sectorId, tracked }) => {
        const db = await getDb();
        let bets = db.data.bets;
        if (sectorId) bets = bets.filter((b) => b.sectorIds.includes(sectorId));
        if (tracked !== undefined) bets = bets.filter((b) => b.tracked === tracked);
        return { bets };
      },
    }),

    getSectors: tool({
      description: "Get all sectors.",
      inputSchema: z.object({}),
      execute: async () => {
        const db = await getDb();
        return { sectors: db.data.sectors };
      },
    }),

    getEvidence: tool({
      description: "Get evidence linked to a specific bet.",
      inputSchema: z.object({
        betId: z.string().describe("The bet ID to get evidence for"),
      }),
      execute: async ({ betId }) => {
        const db = await getDb();
        const bet = db.data.bets.find((b) => b.id === betId);
        if (!bet) return { error: "Bet not found", evidence: [] };

        const evidenceIds = bet.linkedEvidence.map((le) => le.evidenceId);
        const evidence = db.data.evidence.filter((e) => evidenceIds.includes(e.id));
        return {
          evidence: evidence.map((e) => {
            const link = bet.linkedEvidence.find((le) => le.evidenceId === e.id);
            return { ...e, direction: link?.direction ?? "supports" };
          }),
        };
      },
    }),

    generateValidationPlan: tool({
      description: "Generate a validation plan with 3-5 action items for a bet.",
      inputSchema: z.object({
        betId: z.string().describe("The bet ID to generate a validation plan for"),
      }),
      execute: async ({ betId }) => {
        const db = await getDb();
        const bet = db.data.bets.find((b) => b.id === betId);
        if (!bet) return { error: "Bet not found" };

        const sector = db.data.sectors.find((s) => bet.sectorIds.includes(s.id));

        const { text } = await generateText({
          model,
          prompt: `Generate 3-5 specific, actionable validation steps for this bet:

Claim: ${bet.claim}
Confidence: ${bet.confidence}
Evidence confidence: ${bet.evidenceConfidence}
Surface: ${bet.surfaceTarget}
Sector: ${sector?.label ?? "Unknown"}

Return ONLY a JSON array of strings, each being one action item. Example:
["Step 1...", "Step 2...", "Step 3..."]`,
          providerOptions: {
            bedrock: {
              reasoningConfig: { type: "enabled", budgetTokens: 2000 },
            },
          },
        });

        let plan: string[] = [];
        try {
          // Extract JSON array from response
          const match = text.match(/\[[\s\S]*\]/);
          if (match) plan = JSON.parse(match[0]);
        } catch {
          plan = [text];
        }

        bet.validationPlan = plan;
        await db.write();

        return { betId, plan };
      },
    }),

    prepareForInterview: tool({
      description: "Generate interview preparation based on current bets and sectors.",
      inputSchema: z.object({
        personDescription: z.string().describe("Description of the person you're interviewing (role, company, etc.)"),
      }),
      execute: async ({ personDescription }) => {
        const db = await getDb();
        const sectors = db.data.sectors.filter((s) => s.status !== "killed");
        const bets = db.data.bets.filter((b) => b.tracked);

        const { text } = await generateText({
          model,
          prompt: `Prepare for a customer discovery interview.

Person: ${personDescription}

Active sectors:
${sectors.map((s) => `- ${s.label}: ${JSON.stringify(s.definingDimensions)}`).join("\n")}

Tracked bets to validate:
${bets.map((b) => `- [${b.surfaceTarget}] ${b.claim} (confidence: ${b.confidence}, evidence: ${b.evidenceConfidence})`).join("\n")}

Generate:
1. Key questions to ask (5-8 questions)
2. Signals to listen for
3. Which bets this interview could update
4. Things to avoid asking (leading questions, etc.)`,
          providerOptions: {
            bedrock: {
              reasoningConfig: { type: "enabled", budgetTokens: 4000 },
            },
          },
        });

        return { preparation: text };
      },
    }),

    processInterviewNotes: tool({
      description: "Process interview notes to extract evidence and propose bet updates.",
      inputSchema: z.object({
        notes: z.string().describe("Raw interview notes"),
        contactName: z.string().describe("Name of the person interviewed"),
        contactRole: z.string().describe("Role/title of the person interviewed"),
      }),
      execute: async ({ notes, contactName, contactRole }) => {
        const db = await getDb();

        // Create conversation record
        const conversationId = crypto.randomUUID();
        const now = new Date().toISOString();

        const activeSectorIds = db.data.sectors
          .filter((s) => s.status !== "killed")
          .map((s) => s.id);

        db.data.conversations.push({
          id: conversationId,
          rawNotes: notes,
          companyCoordinates: {},
          contactName,
          contactRole,
          sectorIds: activeSectorIds,
          createdAt: now,
          processed: false,
        });

        // Use LLM to extract evidence and suggest bet updates
        const bets = db.data.bets.filter((b) => b.tracked);

        const { text } = await generateText({
          model,
          prompt: `Analyze these interview notes and extract evidence relevant to our bets.

Interview with: ${contactName} (${contactRole})
Notes:
${notes}

Current tracked bets:
${bets.map((b) => `- [${b.id}] [${b.surfaceTarget}] ${b.claim}`).join("\n")}

Return a JSON object with:
{
  "evidence": [{ "content": "...", "signalQuality": "low|medium|high|highest", "tags": ["..."], "supportsBetIds": ["..."], "direction": "supports|challenges" }],
  "betUpdates": [{ "betId": "...", "newConfidence": 0.0-1.0, "reason": "..." }]
}`,
          providerOptions: {
            bedrock: {
              reasoningConfig: { type: "enabled", budgetTokens: 6000 },
            },
          },
        });

        let extracted = { evidence: [] as Array<{ content: string; signalQuality: string; tags: string[]; supportsBetIds: string[]; direction: string }>, betUpdates: [] as Array<{ betId: string; newConfidence: number; reason: string }> };
        try {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) extracted = JSON.parse(match[0]);
        } catch {
          // If parsing fails, just record the conversation
        }

        // Create evidence records
        const newEvidence = extracted.evidence.map((e) => {
          const evidenceId = crypto.randomUUID();

          // Link evidence to relevant bets
          for (const betId of e.supportsBetIds ?? []) {
            const bet = db.data.bets.find((b) => b.id === betId);
            if (bet) {
              bet.linkedEvidence.push({
                evidenceId,
                direction: (e.direction as "supports" | "challenges") ?? "supports",
              });
            }
          }

          return {
            id: evidenceId,
            content: e.content,
            sourceType: "conversation" as const,
            sourceConversationId: conversationId,
            sourceCompanyCoordinates: {},
            sourceRole: contactRole,
            signalQuality: (e.signalQuality ?? "medium") as "near_zero" | "low" | "medium" | "high" | "highest",
            createdAt: now,
            tags: e.tags ?? [],
          };
        });

        db.data.evidence.push(...newEvidence);

        // Create proposals for bet updates
        const proposals = extracted.betUpdates.map((update) => ({
          id: crypto.randomUUID(),
          agentName: "post_conversation_agent",
          type: "bet_update",
          data: update,
          status: "pending" as const,
          createdAt: now,
        }));

        db.data.proposals.push(...proposals);

        // Mark conversation as processed
        const conv = db.data.conversations.find((c) => c.id === conversationId);
        if (conv) conv.processed = true;

        await db.write();

        return {
          conversationId,
          evidenceExtracted: newEvidence.length,
          betUpdatesProposed: proposals.length,
          evidence: newEvidence.map((e) => ({ content: e.content, signalQuality: e.signalQuality })),
          proposedUpdates: extracted.betUpdates,
        };
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();
  const stage = await detectStage();

  const systemPrompt =
    stage === "ingestion" ? INGESTION_PROMPT
      : stage === "conjecture" ? CONJECTURE_PROMPT
        : EXPLORATION_PROMPT;

  const tools =
    stage === "ingestion" ? ingestionTools()
      : stage === "conjecture" ? conjectureTools()
        : explorationTools();

  const result = streamText({
    model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      bedrock: {
        reasoningConfig: { type: "enabled", budgetTokens: 4000 },
      },
    },
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
