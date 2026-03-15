import { createAgent } from "../agent";
import { Output, tool } from "ai";
import { z } from "zod";
import { searchWeb } from "../tools/web-search";
import type {
  ProductProblemRepresentation,
  Sector,
  Conjecture,
  Bet,
  Evidence,
} from "../types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const evidenceItemSchema = z.object({
  content: z.string().describe("The evidence content — a specific data point, quote, or finding"),
  signalQuality: z.enum(["near_zero", "low", "medium", "high", "highest"]).describe("How strong is this signal?"),
  tags: z.array(z.string()).describe("Tags for categorizing this evidence"),
});

const betItemSchema = z.object({
  claim: z.string().describe("A specific, testable hypothesis about this sector"),
  confidence: z.number().min(0).max(1).describe("Your confidence in this claim (0-1)"),
  evidenceConfidence: z.number().min(0).max(1).describe("How well-evidenced is this claim (0-1, always <= confidence)"),
  surfaceTarget: z.enum(["need", "buying_power", "deliverability", "incumbent_gap"]).describe("Primary surface this bet targets"),
  secondarySurfaces: z.array(z.enum(["need", "buying_power", "deliverability", "incumbent_gap"])).describe("Other surfaces this bet touches"),
  updatePower: z.enum(["low", "moderate", "high", "very_high"]).describe("How much would validating this update our sector thesis?"),
  testabilityDifficulty: z.enum(["trivial", "easy", "moderate", "hard", "very_hard"]).describe("How hard is it to test this claim?"),
  isLoadBearing: z.boolean().describe("If this bet is false, does the whole sector thesis collapse?"),
  linkedEvidenceIndices: z.array(z.number()).describe("Indices into the evidence array that support/challenge this bet"),
  evidenceDirections: z.array(z.enum(["supports", "challenges"])).describe("Direction of each linked evidence (parallel to linkedEvidenceIndices)"),
});

const researchOutputSchema = z.object({
  evidence: z.array(evidenceItemSchema),
  bets: z.array(betItemSchema),
});

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const INSTRUCTIONS = `You are a deep research analyst for a GTM discovery system.

Given a product's PPR (Product-Problem Representation), a target sector, and a conjecture about that sector, your job is to:

1. Search the web for relevant market data, industry reports, competitor information, and signals about this sector
2. Synthesize your findings into structured evidence
3. Generate testable hypotheses (bets) about whether this sector is a viable beachhead

## Research Strategy

- Search for: market size, growth trends, pain points, existing solutions, buyer personas, recent news
- Look for both supporting AND challenging evidence
- Focus on specifics: numbers, company names, product names, pricing, adoption rates
- Search multiple angles: industry verticals, job roles, technology trends, regulatory changes

## Bet Generation Guidelines

- Each bet should be a specific, testable claim (not vague)
- Assign surfaceTarget based on what the bet primarily tests:
  - "need": Does this segment actually have the pain?
  - "buying_power": Can they pay and do they have budget authority?
  - "deliverability": Can we actually serve this segment with current capabilities?
  - "incumbent_gap": Is there a meaningful gap in existing solutions?
- confidence: Your overall belief this is true (factor in reasoning + evidence)
- evidenceConfidence: How well-supported by hard evidence (always <= confidence — gut feel can exceed evidence)
- isLoadBearing: true if this bet being wrong would invalidate the entire sector thesis
- Generate 4-8 bets covering different surfaces

## Evidence Guidelines

- Each evidence item should be a specific, citable finding
- signalQuality: how reliable is this data point?
- Link evidence to bets using the indices arrays`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function deepResearch(
  ppr: ProductProblemRepresentation,
  sector: Sector,
  conjecture: Conjecture,
) {
  const agent = createAgent({
    name: "research",
    instructions: INSTRUCTIONS,
    tools: {
      webSearch: tool({
        description: "Search the web for market research, industry data, competitor analysis, and other relevant information.",
        inputSchema: z.object({
          query: z.string().describe("The search query"),
        }),
        execute: async ({ query }) => {
          const results = await searchWeb(query);
          return { results };
        },
      }),
    },
    output: Output.object({ schema: researchOutputSchema }),
    maxSteps: 15,
    thinkingBudget: 10000,
  });

  const prompt = `Research this sector and generate hypotheses:

## Product-Problem Representation
${JSON.stringify(ppr, null, 2)}

## Target Sector
Label: ${sector.label}
Dimensions: ${JSON.stringify(sector.definingDimensions, null, 2)}

## Conjecture
${conjecture.summary}

Reasoning: ${conjecture.reasoning}

Search the web for relevant data about this sector, then generate structured evidence and bets.`;

  const { output } = await agent.generate({ prompt });

  const now = new Date().toISOString();

  // Create Evidence records
  const evidenceRecords: Evidence[] = output.evidence.map((e: { content: string; signalQuality: Evidence["signalQuality"]; tags: string[] }) => ({
    id: crypto.randomUUID(),
    content: e.content,
    sourceType: "desk_research" as const,
    sourceConversationId: null,
    sourceCompanyCoordinates: {},
    sourceRole: null,
    signalQuality: e.signalQuality,
    createdAt: now,
    tags: e.tags,
  }));

  // Create Bet records with linked evidence
  const betRecords: Bet[] = output.bets.map((b: {
    claim: string;
    confidence: number;
    evidenceConfidence: number;
    surfaceTarget: Bet["surfaceTarget"];
    secondarySurfaces: Bet["surfaceTarget"][];
    updatePower: Bet["updatePower"];
    testabilityDifficulty: Bet["testabilityDifficulty"];
    isLoadBearing: boolean;
    linkedEvidenceIndices: number[];
    evidenceDirections: ("supports" | "challenges")[];
  }) => ({
    id: crypto.randomUUID(),
    claim: b.claim,
    confidence: b.confidence,
    evidenceConfidence: Math.min(b.evidenceConfidence, b.confidence),
    linkedEvidence: b.linkedEvidenceIndices.map((idx: number, i: number) => ({
      evidenceId: evidenceRecords[idx]?.id ?? "",
      direction: b.evidenceDirections[i] ?? ("supports" as const),
    })).filter((le: { evidenceId: string }) => le.evidenceId !== ""),
    surfaceTarget: b.surfaceTarget,
    secondarySurfaces: b.secondarySurfaces,
    updatePower: b.updatePower,
    testabilityDifficulty: b.testabilityDifficulty,
    isLoadBearing: b.isLoadBearing,
    createdAt: now,
    createdBy: "research_agent" as const,
    sectorIds: [sector.id],
    tracked: true,
    validationPlan: [],
  }));

  return { bets: betRecords, evidence: evidenceRecords };
}
