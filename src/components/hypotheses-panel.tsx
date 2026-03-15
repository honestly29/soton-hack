"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bet, SurfaceType } from "@/lib/types";
import { betPriority } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const SURFACE_OPTIONS: SurfaceType[] = [
  "need",
  "buying_power",
  "deliverability",
  "incumbent_gap",
];

// ---------------------------------------------------------------------------
// HypothesesPanel
// ---------------------------------------------------------------------------

export default function HypothesesPanel() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSurface, setFilterSurface] = useState<SurfaceType | "all">(
    "all",
  );
  const [filterTracked, setFilterTracked] = useState(false);

  const fetchBets = useCallback(async () => {
    try {
      const res = await fetch("/api/bets");
      if (!res.ok) return;
      const data = await res.json();
      setBets(data.bets ?? data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  const handleToggleTrack = useCallback(
    async (bet: Bet) => {
      const newTracked = !bet.tracked;
      // optimistic update
      setBets((prev) =>
        prev.map((b) => (b.id === bet.id ? { ...b, tracked: newTracked } : b)),
      );
      try {
        await fetch(`/api/bets/${bet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tracked: newTracked }),
        });
      } catch {
        // revert
        setBets((prev) =>
          prev.map((b) =>
            b.id === bet.id ? { ...b, tracked: !newTracked } : b,
          ),
        );
      }
    },
    [],
  );

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="inline-block h-3 w-1 animate-pulse bg-accent" />
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted">
          no hypotheses yet — run deep research on accepted conjectures.
        </p>
      </div>
    );
  }

  // Filter
  let filtered = bets;
  if (filterSurface !== "all") {
    filtered = filtered.filter(
      (b) =>
        b.surfaceTarget === filterSurface ||
        b.secondarySurfaces.includes(filterSurface),
    );
  }
  if (filterTracked) {
    filtered = filtered.filter((b) => b.tracked);
  }

  // Sort by priority
  const sorted = [...filtered].sort(
    (a, b) => betPriority(b) - betPriority(a),
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterSurface}
          onChange={(e) =>
            setFilterSurface(e.target.value as SurfaceType | "all")
          }
          className="rounded border border-solid border-divider bg-surface px-3 py-1.5 font-mono text-[length:inherit] text-foreground outline-none"
        >
          <option value="all">all surfaces</option>
          {SURFACE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setFilterTracked((v) => !v)}
          className={`cursor-pointer rounded border border-solid px-3 py-1.5 font-mono text-[length:inherit] ${
            filterTracked
              ? "border-foreground/30 bg-foreground/5 text-foreground"
              : "border-divider bg-surface text-muted"
          }`}
        >
          tracked only
        </button>
      </div>

      {/* Bet cards */}
      <div className="flex flex-col gap-3">
        {sorted.map((bet) => (
          <div
            key={bet.id}
            className="rounded border border-solid border-divider bg-surface px-4 py-3"
          >
            <p className="font-medium text-foreground">{bet.claim}</p>

            {/* Confidence bar */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted">confidence</span>
              <div className="h-1.5 w-24 rounded bg-divider">
                <div
                  className="h-full rounded bg-foreground/60"
                  style={{ width: `${bet.confidence * 100}%` }}
                />
              </div>
              <span className="text-muted">
                {Math.round(bet.confidence * 100)}%
              </span>
            </div>

            {/* Surface badge + priority */}
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded border border-solid border-divider bg-surface-hover px-2 py-0.5 text-[length:inherit] text-muted">
                {bet.surfaceTarget.replace("_", " ")}
              </span>
              <span className="text-muted">
                priority {Math.round(betPriority(bet) * 100) / 100}
              </span>
            </div>

            {/* Track toggle */}
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleToggleTrack(bet)}
                className={`cursor-pointer rounded border border-solid px-2 py-0.5 font-mono text-[length:inherit] ${
                  bet.tracked
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-divider bg-surface text-muted hover:text-foreground"
                }`}
              >
                {bet.tracked ? "tracking" : "track"}
              </button>
            </div>

            {/* Validation plan if tracked */}
            {bet.tracked && bet.validationPlan.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-muted">
                {bet.validationPlan.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
