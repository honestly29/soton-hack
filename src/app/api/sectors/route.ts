import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  return NextResponse.json({ sectors: db.data.sectors });
}
