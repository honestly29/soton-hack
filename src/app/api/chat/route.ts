import { streamText, tool, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { model } from "@/lib/agent";
import { getDb } from "@/lib/store";
import { PPR_FIELDS, type ProductProblemRepresentation, type PPRProgress } from "@/lib/types";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are the Ingestion Copilot for a GTM (Go-To-Market) Discovery system.

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

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      bedrock: {
        reasoningConfig: { type: "enabled", budgetTokens: 4000 },
      },
    },
    tools: {
      updatePPRField: tool({
        description:
          "Update a single field of the Product-Problem Representation in the database. " +
          "Call this whenever you can confidently fill or revise a PPR field based on user input or uploaded material.",
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

          // Initialise PPR if it doesn't exist yet
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

          // Initialise progress tracking if needed
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
          "Retrieve the current PPR and its field-level progress. " +
          "Call this on the first message to understand what has already been filled.",
        inputSchema: z.object({}),
        execute: async () => {
          const db = await getDb();

          const ppr = db.data.ppr;
          const progress = db.data.pprProgress;

          // Build a summary of each field's status
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
    },
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
