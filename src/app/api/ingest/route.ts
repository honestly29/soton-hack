import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ingest } from "@/lib/ingest";
import { getDb } from "@/lib/store";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  // --- Collect files ---
  const files: { buffer: Buffer; fileName: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "file" && value instanceof File) {
      const arrayBuffer = await value.arrayBuffer();
      files.push({
        buffer: Buffer.from(arrayBuffer),
        fileName: value.name,
      });
    }
  }

  // --- Collect repos ---
  const repos: string[] = [];
  const reposRaw = formData.get("repos");
  if (typeof reposRaw === "string" && reposRaw.trim()) {
    repos.push(...reposRaw.split(",").map((r) => r.trim()));
  }

  if (files.length === 0 && repos.length === 0) {
    return NextResponse.json(
      { error: "No files or repos provided" },
      { status: 400 },
    );
  }

  try {
    const result = await ingest({
      files,
      repos,
      accessToken: session.accessToken,
    });

    // Store the proposed PPR for HITL review.
    // The frontend will show this for user confirmation before
    // downstream agents run.
    const db = await getDb();
    db.data.ppr = result.ppr;
    await db.write();

    return NextResponse.json({
      ppr: result.ppr,
      sourceCount: result.sources.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
