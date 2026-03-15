import { extractFromFile, extractFromRepo, type ExtractedSource } from "./extract";
import { assembleContext } from "./assemble";
import { ingestionAgent, type ProductProblemSchema } from "../agents/ingestion";
import { getRootLogger } from "../logger";

const logger = getRootLogger().child("ingest");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestInput {
  /** Uploaded files as { buffer, fileName } pairs. */
  files?: { buffer: Buffer; fileName: string }[];
  /** GitHub repos as "owner/repo" strings. */
  repos?: string[];
  /** GitHub access token for API access (from OAuth session). */
  accessToken?: string;
}

export interface IngestResult {
  ppr: ProductProblemSchema;
  /** Raw context that was assembled and sent to the agent. */
  assembledContext: string;
  /** Individual sources that were extracted. */
  sources: ExtractedSource[];
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full ingestion pipeline:
 *   1. Extract text from all sources (files + repos)
 *   2. Assemble into a single context string
 *   3. Run the ingestion agent to produce a ProductProblemRepresentation
 *
 * Returns the proposed PPR for HITL review.
 */
export async function ingest(input: IngestInput): Promise<IngestResult> {
  const sources: ExtractedSource[] = [];

  // --- Extract files ---
  if (input.files?.length) {
    logger.info(`extracting ${input.files.length} file(s)`);
    const fileResults = await Promise.all(
      input.files.map((f) => extractFromFile(f.buffer, f.fileName)),
    );
    sources.push(...fileResults);
  }

  // --- Extract repos ---
  if (input.repos?.length) {
    for (const repoSlug of input.repos) {
      logger.info(`extracting repo: ${repoSlug}`);
      const [owner, repo] = repoSlug.split("/");
      const repoSources = await extractFromRepo(owner, repo, input.accessToken);
      sources.push(...repoSources);
    }
  }

  if (sources.length === 0) {
    throw new Error("No sources provided for ingestion");
  }

  // --- Assemble context ---
  const assembledContext = assembleContext(sources);
  logger.info(`assembled context: ${sources.length} source(s)`);

  // --- Run ingestion agent ---
  logger.info("running ingestion agent");
  const result = await ingestionAgent.generate({ prompt: assembledContext });

  return {
    ppr: result.output,
    assembledContext,
    sources,
  };
}
