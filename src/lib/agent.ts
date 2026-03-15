import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { ToolLoopAgent, stepCountIs, Output, type ToolSet } from "ai";
import { getRootLogger } from "./logger";

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION,
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
});

export const model = bedrock("us.anthropic.claude-sonnet-4-20250514-v1:0");

const agentsLogger = getRootLogger().child("agents");

interface CreateAgentOptions<
  TOOLS extends ToolSet,
  OUTPUT extends Output.Output,
> {
  name: string;
  instructions: string;
  tools?: TOOLS;
  output?: OUTPUT;
  maxSteps?: number;
  thinkingBudget?: number;
}

export function createAgent<
  TOOLS extends ToolSet = {},
  OUTPUT extends Output.Output = never,
>({
  name,
  instructions,
  tools,
  output,
  maxSteps = 20,
  thinkingBudget = 4000,
}: CreateAgentOptions<TOOLS, OUTPUT>) {
  const logger = agentsLogger.child(name);

  return new ToolLoopAgent<never, TOOLS, OUTPUT>({
    model,
    instructions,
    tools,
    output,
    stopWhen: stepCountIs(maxSteps),
    providerOptions: {
      bedrock: {
        reasoningConfig: { type: "enabled", budgetTokens: thinkingBudget },
      },
    },
    experimental_onStart() {
      logger.info("start");
    },
    experimental_onStepStart({ stepNumber }) {
      logger.info(`step ${stepNumber}`);
    },
    experimental_onToolCallStart({ toolCall }) {
      logger.info("tool:call", { tool: toolCall.toolName, input: toolCall.input });
    },
    experimental_onToolCallFinish({ toolCall }) {
      logger.info("tool:done", { tool: toolCall.toolName });
    },
    onStepFinish({ finishReason, usage }) {
      logger.info("step:done", { finishReason, usage });
    },
    onFinish({ finishReason, usage }) {
      logger.info("done", { finishReason, usage });
    },
  });
}
