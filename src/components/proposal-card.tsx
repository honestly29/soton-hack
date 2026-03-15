"use client";

import { useState } from "react";

interface ProposalCardProps {
  id: string;
  title: string;
  summary: string;
  reasoning?: string;
  status: "pending" | "accepted" | "rejected";
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export default function ProposalCard({
  id,
  title,
  summary,
  reasoning,
  status,
  onAccept,
  onReject,
}: ProposalCardProps) {
  const [localStatus, setLocalStatus] = useState(status);

  const handleAccept = () => {
    setLocalStatus("accepted");
    onAccept(id);
  };

  const handleReject = () => {
    setLocalStatus("rejected");
    onReject(id);
  };

  const isAccepted = localStatus === "accepted";
  const isRejected = localStatus === "rejected";

  return (
    <div
      className={`rounded border border-solid px-4 py-3 transition-colors ${
        isAccepted
          ? "border-foreground/20 bg-foreground/5"
          : isRejected
            ? "border-divider bg-surface opacity-50"
            : "border-divider bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`font-medium text-foreground ${isRejected ? "line-through" : ""}`}
        >
          {isAccepted && (
            <span className="mr-1.5 text-foreground">&#10003;</span>
          )}
          {title}
        </p>
      </div>

      <p className="mt-1 line-clamp-2 text-muted">{summary}</p>

      {reasoning && (
        <p className="mt-1 line-clamp-1 text-muted/70">{reasoning}</p>
      )}

      {localStatus === "pending" && (
        <div className="mt-2 flex gap-4">
          <button
            type="button"
            onClick={handleAccept}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-foreground hover:text-accent"
          >
            accept
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-muted hover:text-accent"
          >
            reject
          </button>
        </div>
      )}
    </div>
  );
}
