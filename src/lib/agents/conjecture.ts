import { createAgent } from "../agent";
import { Output } from "ai";
import { z } from "zod";
import { getDb } from "../store";
import type { Sector, Conjecture, Proposal } from "../types";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const conjectureItemSchema = z.object({
  sectorLabel: z.string().describe("A concise label for this customer segment, e.g. 'Mid-market fintech compliance teams'"),
  definingDimensions: z.record(z.string(), z.string()).describe("Key dimensions that define this segment: industry, company size, role, tech stack, etc."),
  summary: z.string().describe("One-paragraph summary of why this segment could be a beachhead"),
  reasoning: z.string().describe("Why this segment is a strong candidate: pain intensity, accessibility, willingness to pay, etc."),
});

const conjecturesOutputSchema = z.object({
  conjectures: z.array(conjectureItemSchema).min(5).max(8),
});

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const INSTRUCTIONS = `You are a GTM strategist specializing in beachhead market identification.

Given a Product-Problem Representation (PPR), identify 5-8 potential beachhead customer segments. Each segment should be a specific, narrow group that could become the product's first market.

For each segment, provide:
- sectorLabel: A concise, descriptive label
- definingDimensions: Key characteristics (industry, company size, role, geography, tech stack, etc.)
- summary: Why this segment could be a beachhead — pain intensity, market size, accessibility
- reasoning: Your analytical reasoning for selecting this segment

Prioritize segments where:
1. The pain is acute and frequent (not mild or occasional)
2. The segment is reachable (you can find and contact them)
3. They have budget and authority to buy
4. Incumbents are weak or absent
5. The product's current capabilities are sufficient (no major roadmap dependency)

Be specific and concrete. "Enterprise SaaS companies" is too broad. "Series B-D developer tools companies with 50-200 engineers scaling their CI/CD pipeline" is better.

Vary the segments across different dimensions — don't just list variations of the same archetype.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateConjectures() {
  const db = await getDb();
  const ppr = db.data.ppr;

  if (!ppr) {
    throw new Error("PPR not found — cannot generate conjectures without a product-problem representation");
  }

  const agent = createAgent({
    name: "conjecture",
    instructions: INSTRUCTIONS,
    output: Output.object({ schema: conjecturesOutputSchema }),
    maxSteps: 3,
    thinkingBudget: 10000,
  });

  const { output } = await agent.generate({
    prompt: `Analyze this Product-Problem Representation and identify 5-8 beachhead customer segments:\n\n${JSON.stringify(ppr, null, 2)}`,
  });

  const now = new Date().toISOString();
  const sectors: Sector[] = [];
  const conjectures: Conjecture[] = [];
  const proposals: Proposal[] = [];

  for (const item of output.conjectures) {
    const sectorId = crypto.randomUUID();
    const conjectureId = crypto.randomUUID();
    const proposalId = crypto.randomUUID();

    sectors.push({
      id: sectorId,
      label: item.sectorLabel,
      definingDimensions: item.definingDimensions,
      status: "conjecture",
      createdAt: now,
    });

    conjectures.push({
      id: conjectureId,
      sectorId,
      summary: item.summary,
      reasoning: item.reasoning,
      status: "pending",
      createdAt: now,
    });

    proposals.push({
      id: proposalId,
      agentName: "conjecture_agent",
      type: "new_conjecture",
      data: {
        conjectureId,
        sectorId,
        sectorLabel: item.sectorLabel,
        summary: item.summary,
        reasoning: item.reasoning,
        definingDimensions: item.definingDimensions,
      },
      status: "pending",
      createdAt: now,
    });
  }

  // Write to DB
  db.data.sectors.push(...sectors);
  db.data.conjectures.push(...conjectures);
  db.data.proposals.push(...proposals);
  await db.write();

  return { sectors, conjectures, proposals };
}
