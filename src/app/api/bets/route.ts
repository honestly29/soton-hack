import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sectorId = searchParams.get("sectorId");
  const tracked = searchParams.get("tracked");

  const db = await getDb();
  let bets = db.data.bets;

  if (sectorId) {
    bets = bets.filter((b) => b.sectorIds.includes(sectorId));
  }

  if (tracked !== null) {
    bets = bets.filter((b) => b.tracked === (tracked === "true"));
  }

  return NextResponse.json({ bets });
}
