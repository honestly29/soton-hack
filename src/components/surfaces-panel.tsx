"use client";

import { useCallback, useEffect, useState } from "react";
import type { Sector, ComputedSurface, Bet, SectorStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// SurfaceBar
// ---------------------------------------------------------------------------

function SurfaceBar({
  label,
  betLevel,
  evidenceLevel,
}: {
  label: string;
  betLevel: number;
  evidenceLevel: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-muted">
        {label.replace("_", " ")}
      </span>
      <div className="relative h-2 flex-1 rounded bg-divider">
        <div
          className="absolute inset-y-0 left-0 rounded bg-accent/40"
          style={{ width: `${betLevel * 100}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded bg-foreground/60"
          style={{ width: `${evidenceLevel * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-muted">
        {Math.round(betLevel * 100)}
      </span>
    </div>
  );
}

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

  const SURFACE_TYPES = [
    "need",
    "buying_power",
    "deliverability",
    "incumbent_gap",
  ] as const;

  function getSurface(sectorId: string, surfaceType: string) {
    return data!.surfaces.find(
      (s) => s.sectorId === sectorId && s.surfaceType === surfaceType,
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.sectors.map((sector) => (
          <div
            key={sector.id}
            className="rounded border border-solid border-divider bg-surface px-4 py-3"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="font-medium text-foreground">
                {sector.label}
              </span>
              <span
                className={`rounded border border-solid px-2 py-0.5 text-[length:inherit] ${STATUS_COLORS[sector.status]}`}
              >
                {sector.status}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {SURFACE_TYPES.map((st) => {
                const surface = getSurface(sector.id, st);
                return (
                  <SurfaceBar
                    key={st}
                    label={st}
                    betLevel={surface?.betLevel ?? 0}
                    evidenceLevel={surface?.evidenceLevel ?? 0}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
