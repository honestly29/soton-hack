"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { Sector, ComputedSurface, Bet, SectorStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<SectorStatus, string> = {
  conjecture: "text-muted border-divider",
  researching: "text-accent border-accent/30",
  testing: "text-foreground border-foreground/30",
  active: "text-foreground border-foreground/40",
  paused: "text-divider border-divider",
  killed: "text-muted border-divider line-through",
};

const SURFACE_LABELS: Record<string, string> = {
  need: "NEED",
  buying_power: "BUYING",
  deliverability: "DELIVER",
  incumbent_gap: "GAP",
};

// ---------------------------------------------------------------------------
// Radar card per sector
// ---------------------------------------------------------------------------

function SectorRadar({
  sector,
  surfaces,
  betCount,
}: {
  sector: Sector;
  surfaces: ComputedSurface[];
  betCount: number;
}) {
  const SURFACE_TYPES = ["need", "buying_power", "deliverability", "incumbent_gap"] as const;

  // Build raw values first, then compute dynamic scale
  const rawValues = SURFACE_TYPES.map((st) => {
    const s = surfaces.find((x) => x.surfaceType === st);
    return { bet: s?.betLevel ?? 0, evidence: s?.evidenceLevel ?? 0 };
  });

  // Dynamic domain: scale to make gaps visible
  // Min anchored at 0, max at the ceiling of highest value + headroom
  const allValues = rawValues.flatMap((v) => [v.bet, v.evidence]);
  const maxVal = Math.max(...allValues, 0.1);
  const domainMax = Math.ceil(maxVal * 12) / 10; // ~20% headroom, rounded up

  const radarData = SURFACE_TYPES.map((st, i) => ({
    surface: SURFACE_LABELS[st],
    bet: rawValues[i].bet * 100 / domainMax,
    evidence: rawValues[i].evidence * 100 / domainMax,
    // Store raw for tooltip
    rawBet: Math.round(rawValues[i].bet * 100),
    rawEvidence: Math.round(rawValues[i].evidence * 100),
    fullMark: 100,
  }));

  const avgGap =
    surfaces.length > 0
      ? surfaces.reduce((sum, s) => sum + Math.abs(s.gap), 0) / surfaces.length
      : 0;

  return (
    <div className="rounded border border-solid border-divider bg-surface px-5 py-4">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-foreground">{sector.label}</span>
        <span
          className={`rounded border border-solid px-2 py-0.5 text-[length:inherit] ${STATUS_COLORS[sector.status]}`}
        >
          {sector.status}
        </span>
      </div>

      {/* Radar chart */}
      <div className="mx-auto" style={{ width: 260, height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid
              stroke="#D4CFC6"
              strokeDasharray="2 2"
            />
            <PolarAngleAxis
              dataKey="surface"
              tick={{
                fill: "#8A8078",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            />
            {/* Bet layer — larger polygon, accent fill */}
            <Radar
              name="bet"
              dataKey="bet"
              stroke="#5C4D3C"
              fill="#5C4D3C"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            {/* Evidence layer — smaller polygon, solid fill to punch out the gap */}
            <Radar
              name="evidence"
              dataKey="evidence"
              stroke="#8A8078"
              fill="#F5F3EF"
              fillOpacity={0.85}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div className="mt-1 flex justify-between text-muted">
        <span>{betCount} bets</span>
        <span>gap {Math.round(avgGap * 100)}%</span>
      </div>

      {/* Legend */}
      <div className="mt-2 flex gap-4 text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded bg-accent/30" />
          conviction
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded bg-divider" />
          evidence
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SurfacesPanel
// ---------------------------------------------------------------------------

interface DashboardData {
  sectors: Sector[];
  surfaces: ComputedSurface[];
  bets: Bet[];
}

export default function SurfacesPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        setError("failed to load dashboard");
        return;
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch {
      setError("failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="inline-block h-3 w-1 animate-pulse bg-accent" />
      </div>
    );
  }

  if (data.sectors.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted">
          no sectors yet — confirm product context and generate conjectures to
          see surfaces.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {data.sectors.map((sector) => {
          const sectorSurfaces = data.surfaces.filter(
            (s) => s.sectorId === sector.id,
          );
          const sectorBets = data.bets.filter((b) =>
            b.sectorIds.includes(sector.id),
          );
          return (
            <SectorRadar
              key={sector.id}
              sector={sector}
              surfaces={sectorSurfaces}
              betCount={sectorBets.length}
            />
          );
        })}
      </div>
    </div>
  );
}
