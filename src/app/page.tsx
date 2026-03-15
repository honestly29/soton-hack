"use client";

import { useState, useCallback, useEffect } from "react";
import TabBar, { type TabId, type TabDef } from "@/components/tab-bar";
import ChatPanel from "@/components/chat-panel";
import ChatSidebar from "@/components/chat-sidebar";
import LockedPanel from "@/components/locked-panel";
import {
  type PPRProgress,
  type ProductProblemRepresentation,
  PPR_FIELDS,
} from "@/lib/types";

interface PPRState {
  ppr: ProductProblemRepresentation | null;
  pprConfirmed: boolean;
  pprProgress: PPRProgress | null;
}

export default function Home() {
  const [currentTab, setCurrentTab] = useState<TabId>("chat");
  const [pprState, setPprState] = useState<PPRState>({
    ppr: null,
    pprConfirmed: false,
    pprProgress: null,
  });

  // Fetch PPR state from the server
  const fetchPPR = useCallback(async () => {
    try {
      const res = await fetch("/api/ppr");
      if (!res.ok) return;
      const data: PPRState = await res.json();
      setPprState(data);
    } catch {
      // Silently ignore fetch errors (e.g. not logged in yet)
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchPPR();
  }, [fetchPPR]);

  // Refetch when chat stream finishes (status goes to "ready")
  const handleChatStatusChange = useCallback(
    (status: string) => {
      if (status === "ready") {
        fetchPPR();
      }
    },
    [fetchPPR],
  );

  // Confirm all PPR fields
  const handleConfirmAll = useCallback(async () => {
    try {
      const res = await fetch("/api/ppr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) return;
      const data: PPRState = await res.json();
      setPprState(data);
    } catch {
      // ignore
    }
  }, []);

  // Update a single PPR field (inline edit)
  const handleFieldEdit = useCallback(
    async (field: keyof ProductProblemRepresentation, value: string) => {
      try {
        const res = await fetch("/api/ppr", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [field]: value } }),
        });
        if (!res.ok) return;
        const data: PPRState = await res.json();
        setPprState(data);
      } catch {
        // ignore
      }
    },
    [],
  );

  // Derive tab lock states from PPR
  const hasPPR = pprState.pprConfirmed;
  const requiredDone = pprState.pprProgress
    ? PPR_FIELDS.filter((f) => f.tier === "required").every(
        (f) => pprState.pprProgress![f.key] !== "empty",
      )
    : false;
  const hasSectors = hasPPR; // Once PPR is confirmed, surfaces/hypotheses unlock

  const tabs: TabDef[] = [
    { id: "chat", label: "chat", state: "active" },
    { id: "surfaces", label: "surfaces", state: hasSectors ? "active" : "locked" },
    { id: "hypotheses", label: "hypotheses", state: hasSectors ? "active" : "locked" },
    { id: "people", label: "people", state: hasPPR ? "active" : "locked" },
  ];

  return (
    <div className="flex h-screen flex-col">
      <TabBar tabs={tabs} current={currentTab} onSelect={setCurrentTab} />

      <div className="flex flex-1 overflow-hidden">
        {currentTab === "chat" && (
          <>
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                endpoint="/api/chat"
                onStatusChange={handleChatStatusChange}
              />
            </div>
            <div className="w-96 shrink-0 overflow-y-auto">
              <ChatSidebar
                ppr={pprState.ppr}
                progress={pprState.pprProgress}
                confirmed={pprState.pprConfirmed}
                requiredDone={requiredDone}
                onFieldEdit={handleFieldEdit}
                onConfirmAll={handleConfirmAll}
              />
            </div>
          </>
        )}

        {currentTab === "surfaces" && (
          hasSectors ? (
            <div className="flex-1 p-4">
              {/* TODO: surfaces view */}
              <p className="text-divider">surfaces view</p>
            </div>
          ) : (
            <LockedPanel
              label="surfaces"
              reason="complete product context in chat to unlock"
            />
          )
        )}

        {currentTab === "hypotheses" && (
          hasSectors ? (
            <div className="flex-1 p-4">
              {/* TODO: hypotheses quest board */}
              <p className="text-divider">hypotheses view</p>
            </div>
          ) : (
            <LockedPanel
              label="hypotheses"
              reason="complete product context in chat to unlock"
            />
          )
        )}

        {currentTab === "people" && (
          hasPPR ? (
            <div className="flex-1 p-4">
              {/* TODO: people CRM + graph */}
              <p className="text-divider">people view</p>
            </div>
          ) : (
            <LockedPanel
              label="people"
              reason="complete product context in chat to unlock"
            />
          )
        )}
      </div>
    </div>
  );
}
