import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";
import type { SectorStatus } from "@/lib/types";

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
  const { label, definingDimensions, status } = body as {
    label?: string;
    definingDimensions?: Record<string, unknown>;
    status?: SectorStatus;
  };

  const db = await getDb();
  const sector = db.data.sectors.find((s) => s.id === id);
  if (!sector) {
    return NextResponse.json({ error: "Sector not found" }, { status: 404 });
  }

  if (label !== undefined) sector.label = label;
  if (definingDimensions !== undefined) sector.definingDimensions = definingDimensions;
  if (status !== undefined) sector.status = status;

  await db.write();

  return NextResponse.json({ sector });
}
