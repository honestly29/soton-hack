"use client";

import { useCallback, useEffect, useState } from "react";
import type { Conjecture, ConjectureStatus } from "@/lib/types";

const STATUS_ICON: Record<ConjectureStatus, string> = {
  pending: "~",
  accepted: "\u2713",
  rejected: "\u2717",
  researched: "\u2713",
};

const STATUS_COLOR: Record<ConjectureStatus, string> = {
  pending: "text-accent",
  accepted: "text-foreground",
  rejected: "text-divider",
  researched: "text-foreground",
};

export default function ConjectureSidebar() {
  const [conjectures, setConjectures] = useState<Conjecture[]>([]);

  const fetchConjectures = useCallback(async () => {
    try {
      const res = await fetch("/api/conjectures");
      if (!res.ok) return;
      const data = await res.json();
      setConjectures(data.conjectures ?? data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchConjectures();
    const interval = setInterval(fetchConjectures, 10_000);
    return () => clearInterval(interval);
  }, [fetchConjectures]);

  // Group by status: accepted first, then pending, then rejected
  const order: ConjectureStatus[] = ["accepted", "researched", "pending", "rejected"];
  const sorted = [...conjectures].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
  );

  const accepted = conjectures.filter(
    (c) => c.status === "accepted" || c.status === "researched",
  ).length;

  return (
    <div className="flex h-full flex-col border-l-2 border-solid border-divider bg-surface px-5 py-5">
      <h3 className="mb-4 font-medium tracking-wide text-foreground">
        CONJECTURES
      </h3>

      {sorted.length === 0 ? (
        <p className="text-muted">no conjectures yet</p>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {sorted.map((c) => (
            <li key={c.id} className="flex items-start gap-2 px-2 py-1.5">
              <span
                className={`w-4 shrink-0 text-center font-mono ${STATUS_COLOR[c.status]}`}
              >
                {STATUS_ICON[c.status]}
              </span>
              <span
                className={
                  c.status === "rejected"
                    ? "text-divider line-through"
                    : "text-foreground"
                }
              >
                {c.summary}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto border-t-2 border-solid border-divider pt-4">
        <span className="text-muted">
          {accepted}/{conjectures.length} accepted
        </span>
      </div>
    </div>
  );
}
