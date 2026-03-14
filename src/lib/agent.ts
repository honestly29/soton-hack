import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
  type ModelMessage,
  type Tool,
} from "ai";

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION,
  apiKey: process.env.AWS_BEARER_TOKEN_BEDROCK,
});

const model = bedrock("us.anthropic.claude-sonnet-4-20250514-v1:0");

type AgentOptions =
  | {
      system?: string;
      prompt: string;
      messages?: undefined;
      tools?: Record<string, Tool>;
      maxSteps?: number;
    }
  | {
      system?: string;
      prompt?: undefined;
      messages: ModelMessage[];
      tools?: Record<string, Tool>;
      maxSteps?: number;
    };

export async function generateResponse(options: AgentOptions) {
  return aiGenerateText({
    model,
    ...options,
  });
}

export function streamResponse(options: AgentOptions) {
  return aiStreamText({
    model,
    ...options,
  });
}
