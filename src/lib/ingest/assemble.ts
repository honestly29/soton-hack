import type { ExtractedSource } from "./extract";

// ---------------------------------------------------------------------------
// Context assembly
//
// Concatenates extracted sources into a single string for the LLM.
// Future: add token budget awareness, summarise-if-too-large fallback.
// ---------------------------------------------------------------------------

/**
 * Assemble extracted sources into a single LLM-ready context string.
 *
 * Each source is separated by a clear header so the LLM can
 * attribute information back to its origin.
 */
export function assembleContext(sources: ExtractedSource[]): string {
  return sources
    .map((s) => `=== SOURCE: ${s.name} ===\n\n${s.text}`)
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Future scaffolding
// ---------------------------------------------------------------------------

// TODO: token counting — count assembled context against model limit,
//       fall back to map-reduce (summarise each doc, then synthesise)
//       if total exceeds ~120k tokens.

// TODO: relevance filtering — rank sources by likely relevance to
//       product understanding, drop lowest-value sources first.
