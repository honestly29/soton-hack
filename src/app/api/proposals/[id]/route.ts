import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, resolvedData } = body as {
    status?: "accepted" | "rejected";
    resolvedData?: unknown;
  };

  const db = await getDb();
  const proposal = db.data.proposals.find((p) => p.id === id);
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  if (status) {
    proposal.status = status;

    // When accepting/rejecting a conjecture proposal, update the conjecture too
    if (proposal.type === "new_conjecture") {
      const conjectureId = (proposal.data as { conjectureId: string }).conjectureId;
      const conjecture = db.data.conjectures.find((c) => c.id === conjectureId);
      if (conjecture) {
        conjecture.status = status === "accepted" ? "accepted" : "rejected";
      }

      // Update sector status if accepting
      if (status === "accepted" && conjecture) {
        const sector = db.data.sectors.find((s) => s.id === conjecture.sectorId);
        if (sector) sector.status = "researching";
      }
    }
  }

  if (resolvedData !== undefined) {
    proposal.data = resolvedData;
  }

  await db.write();

  return NextResponse.json({ proposal });
}
