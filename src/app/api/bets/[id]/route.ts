import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";
import type { Bet } from "@/lib/types";

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

  const db = await getDb();
  const bet = db.data.bets.find((b) => b.id === id);
  if (!bet) {
    return NextResponse.json({ error: "Bet not found" }, { status: 404 });
  }

  const allowedFields: (keyof Bet)[] = [
    "claim",
    "confidence",
    "evidenceConfidence",
    "surfaceTarget",
    "secondarySurfaces",
    "updatePower",
    "testabilityDifficulty",
    "isLoadBearing",
    "tracked",
    "validationPlan",
    "sectorIds",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bet as any)[field] = body[field];
    }
  }

  await db.write();

  return NextResponse.json({ bet });
}
