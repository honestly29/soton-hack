import { extractText as extractPdfText } from "unpdf";
import { OfficeParser } from "officeparser";
import { runRemoteAction } from "repomix";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedSource {
  name: string;
  text: string;
}

// ---------------------------------------------------------------------------
// File extraction
// ---------------------------------------------------------------------------

async function extractPdf(buffer: Buffer): Promise<string> {
  const { text } = await extractPdfText(new Uint8Array(buffer), {
    mergePages: true,
  });
  return text;
}

async function extractOffice(buffer: Buffer): Promise<string> {
  const ast = await OfficeParser.parseOffice(buffer);
  return ast.toText();
}

function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

const EXTRACTORS: Record<string, (buf: Buffer) => Promise<string>> = {
  ".pdf": extractPdf,
  ".docx": extractOffice,
  ".pptx": extractOffice,
  ".xlsx": extractOffice,
  ".md": async (b) => extractPlainText(b),
  ".txt": async (b) => extractPlainText(b),
};

/**
 * Extract text from an uploaded file.
 */
export async function extractFromFile(
  buffer: Buffer,
  fileName: string,
): Promise<ExtractedSource> {
  const ext = path.extname(fileName).toLowerCase();
  const extractor = EXTRACTORS[ext];

  if (!extractor) {
    return { name: fileName, text: `[Unsupported file type: ${ext}]` };
  }

  const text = await extractor(buffer);
  return { name: fileName, text };
}

// ---------------------------------------------------------------------------
// GitHub repo extraction  (Repomix — targeted stuffing)
//
// Future: swap internals for agentic exploration (tool-based fs access)
// without changing the function signature.
// ---------------------------------------------------------------------------

const PRODUCT_INCLUDE = [
  "README*",
  "readme*",
  "docs/**",
  "documentation/**",
  "CHANGELOG*",
  "HISTORY*",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "docker-compose*",
  "Dockerfile*",
  ".env.example",
  "LICENSE*",
  "**/openapi*",
  "**/swagger*",
].join(",");

/**
 * Extract product-relevant context from a GitHub repo.
 *
 * Uses Repomix's runRemoteAction to clone and pack the repo.
 * Returns the packed output as a single ExtractedSource.
 *
 * Future: add a second architecture pass with Tree-sitter compression,
 * or swap to agentic fs-access exploration.
 */
export async function extractFromRepo(
  owner: string,
  repo: string,
  _accessToken?: string,
): Promise<ExtractedSource[]> {
  const repoUrl = `https://github.com/${owner}/${repo}`;

  // runRemoteAction takes CLI-style options, clones, packs, and cleans up.
  const result = await runRemoteAction(repoUrl, {
    include: PRODUCT_INCLUDE,
    style: "markdown",
    removeComments: false,
    removeEmptyLines: true,
    outputShowLineNumbers: false,
    fileSummary: true,
    includeEmptyDirectories: false,
    gitignore: true,
    defaultPatterns: true,
    ignore: [
      "**/*.test.*",
      "**/__tests__/**",
      "**/node_modules/**",
    ].join(","),
    securityCheck: false,
  });

  // Assemble from processedFiles — each has { path, content }.
  const text = result.packResult.processedFiles
    .map((f) => `### ${f.path}\n\n${f.content}`)
    .join("\n\n---\n\n");

  return [
    {
      name: `${owner}/${repo}`,
      text: text || `[No product-relevant files found in ${repoUrl}]`,
    },
  ];
}
