import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";
import { computeSurface, type SurfaceType } from "@/lib/types";

const SURFACE_TYPES: SurfaceType[] = ["need", "buying_power", "deliverability", "incumbent_gap"];

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const sectors = db.data.sectors.filter((s) => s.status !== "killed");
  const bets = db.data.bets;

  const surfaces = sectors.flatMap((sector) =>
    SURFACE_TYPES.map((surfaceType) =>
      computeSurface(bets, sector.id, surfaceType),
    ),
  );

  return NextResponse.json({ sectors, surfaces, bets });
}
