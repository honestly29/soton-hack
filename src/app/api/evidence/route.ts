import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const betId = searchParams.get("betId");

  const db = await getDb();

  if (betId) {
    const bet = db.data.bets.find((b) => b.id === betId);
    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    const evidenceIds = bet.linkedEvidence.map((le) => le.evidenceId);
    const evidence = db.data.evidence
      .filter((e) => evidenceIds.includes(e.id))
      .map((e) => {
        const link = bet.linkedEvidence.find((le) => le.evidenceId === e.id);
        return { ...e, direction: link?.direction ?? "supports" };
      });

    return NextResponse.json({ evidence });
  }

  return NextResponse.json({ evidence: db.data.evidence });
}
