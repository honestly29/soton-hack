import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const db = await getDb();
  let proposals = db.data.proposals;

  if (status) {
    proposals = proposals.filter((p) => p.status === status);
  }

  return NextResponse.json({ proposals });
}
