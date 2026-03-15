import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/store";
import { PPR_FIELDS, type PPRProgress, type ProductProblemRepresentation } from "@/lib/types";

// GET /api/ppr — return current PPR, confirmation status, and field progress
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  return NextResponse.json({
    ppr: db.data.ppr,
    pprConfirmed: db.data.pprConfirmed,
    pprProgress: db.data.pprProgress,
  });
}

// PUT /api/ppr — accept edited PPR fields and optionally confirm
export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { fields, confirm } = body as {
    fields?: Partial<ProductProblemRepresentation>;
    confirm?: boolean;
  };

  const db = await getDb();

  // Initialise PPR if needed
  if (!db.data.ppr) {
    db.data.ppr = {
      painDescription: "",
      capabilities: "",
      targetPersona: "",
      conditions: "",
      infrastructureRequirements: "",
      currentState: "",
      competitiveLandscape: "",
      pricingModel: "",
      founderAdvantage: "",
      geographicContext: "",
    };
  }

  // Initialise progress if needed
  if (!db.data.pprProgress) {
    db.data.pprProgress = {} as PPRProgress;
    for (const f of PPR_FIELDS) {
      db.data.pprProgress[f.key] = "empty";
    }
  }

  // Apply field edits
  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      const fieldKey = key as keyof ProductProblemRepresentation;
      if (PPR_FIELDS.some((f) => f.key === fieldKey)) {
        db.data.ppr[fieldKey] = value as string;
        // User-edited fields go straight to confirmed
        db.data.pprProgress[fieldKey] = value ? "confirmed" : "empty";
      }
    }
  }

  // Confirm all non-empty fields
  if (confirm) {
    db.data.pprConfirmed = true;
    for (const f of PPR_FIELDS) {
      if (db.data.ppr[f.key]) {
        db.data.pprProgress[f.key] = "confirmed";
      }
    }
  }

  await db.write();

  return NextResponse.json({
    ppr: db.data.ppr,
    pprConfirmed: db.data.pprConfirmed,
    pprProgress: db.data.pprProgress,
  });
}
