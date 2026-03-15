"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bet, Sector, SectorStatus } from "@/lib/types";

const STATUS_COLOR: Record<SectorStatus, string> = {
  conjecture: "text-muted",
  researching: "text-accent",
  testing: "text-foreground",
  active: "text-foreground",
  paused: "text-divider",
  killed: "text-divider line-through",
};

export default function ExplorationSidebar() {
  const [trackedBets, setTrackedBets] = useState<Bet[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [betsRes, sectorsRes] = await Promise.all([
        fetch("/api/bets?tracked=true"),
        fetch("/api/sectors"),
      ]);
      if (betsRes.ok) {
        const betsData = await betsRes.json();
        setTrackedBets(betsData.bets ?? betsData);
      }
      if (sectorsRes.ok) {
        const sectorsData = await sectorsRes.json();
        setSectors(sectorsData.sectors ?? sectorsData);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="flex h-full flex-col border-l-2 border-solid border-divider bg-surface px-5 py-5">
      {/* Tracked bets */}
      <h3 className="mb-3 font-medium tracking-wide text-foreground">
        TRACKED
      </h3>
      {trackedBets.length === 0 ? (
        <p className="mb-5 text-muted">
          track hypotheses to see them here
        </p>
      ) : (
        <ul className="mb-5 space-y-1 overflow-y-auto">
          {trackedBets.map((bet) => (
            <li key={bet.id} className="px-2 py-1.5">
              <span className="text-foreground">{bet.claim}</span>
              <span className="ml-2 text-muted">
                {Math.round(bet.confidence * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Sectors */}
      <h3 className="mb-3 font-medium tracking-wide text-foreground">
        SECTORS
      </h3>
      {sectors.length === 0 ? (
        <p className="text-muted">no sectors yet</p>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {sectors.map((sector) => (
            <li
              key={sector.id}
              className="flex items-center gap-2 px-2 py-1.5"
            >
              <span className="text-foreground">{sector.label}</span>
              <span
                className={`rounded border border-solid border-divider px-1.5 py-0.5 text-[length:inherit] ${STATUS_COLOR[sector.status]}`}
              >
                {sector.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
