import { createAgent } from "../agent";
import { Output } from "ai";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const productProblemSchema = z.object({
  painDescription: z
    .string()
    .describe(
      "What pain or problem does this product solve? Expressed from the customer's perspective, not the builder's.",
    ),
  capabilities: z
    .string()
    .describe(
      "What does the product actually do? Concrete capabilities, not marketing language.",
    ),
  targetPersona: z
    .string()
    .describe(
      "Who experiences this pain? Job title, role, org context. Be specific.",
    ),
  conditions: z
    .string()
    .describe(
      "Under what conditions does the pain arise? Triggers, contexts, workflows.",
    ),
  infrastructureRequirements: z
    .string()
    .describe(
      "What needs to be true of the buyer's environment? Tech stack, team size, process maturity, integrations.",
    ),
  currentState: z
    .string()
    .describe(
      "What exists today vs what is planned? Distinguish shipped capabilities from roadmap.",
    ),
  competitiveLandscape: z
    .string()
    .describe(
      "What existing solutions or incumbents address this pain? How do buyers solve it today?",
    ),
  pricingModel: z
    .string()
    .describe(
      "How does or will the product charge? Subscription, usage-based, per-seat, etc.",
    ),
  founderAdvantage: z
    .string()
    .describe(
      "What unique advantage does the founder/team have? Domain expertise, network, technical moat.",
    ),
  geographicContext: z
    .string()
    .describe(
      "Target markets, geographic focus, regulatory considerations.",
    ),
});

export type ProductProblemSchema = z.infer<typeof productProblemSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const INSTRUCTIONS = `You are an ingestion analyst for a GTM (go-to-market) discovery system.

Your job: given source material about a product or company (documents, README files, code repos, pitch decks, specs), produce a structured product-problem representation.

This representation will be used downstream to generate customer segment hypotheses, so accuracy matters. Extract what is actually stated or clearly implied — do not invent or speculate.

Guidelines:
- painDescription: focus on the customer's pain, not the product's features. What hurts? Why?
- capabilities: be concrete. "AI-powered analytics" is vague. "Extracts structured data from PDF invoices using OCR + LLM" is concrete.
- targetPersona: be specific about role and context. "Engineering managers at mid-size quant funds" not "technical leaders."
- conditions: when does this pain bite? "When the team exceeds 20 engineers and ad-hoc visibility breaks down."
- infrastructureRequirements: what must be true for the product to work? Tech stack, org size, process maturity.
- currentState: distinguish what ships today from what's planned. If unclear, say so.

If the source material is thin on any field, say what you can and flag what's missing rather than fabricating.`;

export const ingestionAgent = createAgent({
  name: "ingestion",
  instructions: INSTRUCTIONS,
  output: Output.object({ schema: productProblemSchema }),
  maxSteps: 3,
  thinkingBudget: 8000,
});
