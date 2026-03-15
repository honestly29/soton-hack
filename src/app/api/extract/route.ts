import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { extractFromFile, extractFromRepo } from "@/lib/ingest/extract";

/**
 * Lightweight extraction endpoint for the chat panel.
 *
 * Accepts FormData with:
 *   - file (File, repeatable) — documents to extract text from
 *   - repos (string, comma-separated) — GitHub repos as "owner/repo"
 *
 * Returns { sources: { name: string, text: string }[] }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  const sources: { name: string; text: string }[] = [];

  // --- Extract files ---
  for (const [key, value] of formData.entries()) {
    if (key === "file" && value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      const result = await extractFromFile(
        Buffer.from(arrayBuffer),
        value.name,
      );
      sources.push(result);
    }
  }

  // --- Extract repos ---
  const reposRaw = formData.get("repos");
  if (typeof reposRaw === "string" && reposRaw.trim()) {
    const repos = reposRaw.split(",").map((r) => r.trim());
    for (const slug of repos) {
      const [owner, repo] = slug.split("/");
      if (owner && repo) {
        const repoSources = await extractFromRepo(
          owner,
          repo,
          session.accessToken,
        );
        sources.push(...repoSources);
      }
    }
  }

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No files or repos provided" },
      { status: 400 },
    );
  }

  return NextResponse.json({ sources });
}
