"use client";

import { useState } from "react";
import {
  PPR_FIELDS,
  type PPRProgress,
  type PPRFieldStatus,
  type ProductProblemRepresentation,
} from "@/lib/types";

interface ChatSidebarProps {
  ppr: ProductProblemRepresentation | null;
  progress: PPRProgress | null;
  confirmed: boolean;
  requiredDone: boolean;
  onFieldEdit: (field: keyof ProductProblemRepresentation, value: string) => void;
  onConfirmAll: () => void;
}

const STATUS_STYLE: Record<PPRFieldStatus, { icon: string; color: string; bg: string }> = {
  empty: { icon: "\u2013", color: "text-divider", bg: "" },
  draft: { icon: "~", color: "text-accent", bg: "bg-accent/5" },
  confirmed: { icon: "\u2713", color: "text-foreground", bg: "bg-foreground/5" },
};

export default function ChatSidebar({
  ppr,
  progress,
  confirmed,
  requiredDone,
  onFieldEdit,
  onConfirmAll,
}: ChatSidebarProps) {
  const [editingField, setEditingField] = useState<keyof ProductProblemRepresentation | null>(null);
  const [editValue, setEditValue] = useState("");

  const tiers = ["required", "recommended", "enrichment"] as const;
  const tierLabels = {
    required: "Required",
    recommended: "Recommended",
    enrichment: "Enrichment",
  };

  const filledRequired = progress
    ? PPR_FIELDS.filter((f) => f.tier === "required" && progress[f.key] !== "empty").length
    : 0;

  const hasAnyDraft = progress
    ? PPR_FIELDS.some((f) => progress[f.key] === "draft")
    : false;

  function startEditing(field: keyof ProductProblemRepresentation) {
    setEditingField(field);
    setEditValue(ppr?.[field] ?? "");
  }

  function commitEdit() {
    if (editingField) {
      onFieldEdit(editingField, editValue);
      setEditingField(null);
      setEditValue("");
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  return (
    <div className="flex h-full flex-col border-l-2 border-solid border-divider bg-surface px-5 py-5">
      <h3 className="mb-4 font-medium tracking-wide text-foreground">
        PRODUCT CONTEXT
      </h3>

      {tiers.map((tier) => (
        <div key={tier} className="mb-5">
          <span className="font-medium text-muted">{tierLabels[tier]}</span>
          <ul className="mt-2 space-y-1">
            {PPR_FIELDS.filter((f) => f.tier === tier).map((field) => {
              const status = progress?.[field.key] ?? "empty";
              const style = STATUS_STYLE[status];
              const isEditing = editingField === field.key;

              return (
                <li key={field.key}>
                  {isEditing ? (
                    <div className="flex flex-col gap-1.5 rounded border border-solid border-accent/30 bg-surface-hover p-2">
                      <span className="text-muted">{field.label}</span>
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            commitEdit();
                          }
                          if (e.key === "Escape") {
                            cancelEdit();
                          }
                        }}
                        autoFocus
                        rows={3}
                        className="w-full resize-none rounded border border-solid border-divider bg-surface px-2 py-1.5 font-mono text-foreground outline-none focus:border-accent"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={commitEdit}
                          className="font-medium text-foreground hover:underline"
                        >
                          save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-muted hover:underline"
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(field.key)}
                      className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left transition-colors ${style.bg} ${style.color} hover:bg-surface-hover hover:text-foreground`}
                      title={ppr?.[field.key] || undefined}
                    >
                      <span className="w-4 shrink-0 text-center font-mono">
                        {style.icon}
                      </span>
                      <span>{field.label}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto border-t-2 border-solid border-divider pt-4">
        <span className="text-muted">
          {progress
            ? `${filledRequired}/3 required`
            : "waiting for input"}
        </span>
        {requiredDone && !confirmed && (
          <span className="ml-2 font-medium text-accent">ready to confirm</span>
        )}
        {confirmed && (
          <span className="ml-2 font-medium text-foreground">confirmed</span>
        )}

        {hasAnyDraft && !confirmed && (
          <button
            onClick={onConfirmAll}
            className="mt-3 block w-full rounded bg-foreground px-3 py-2 font-medium text-background transition-colors hover:bg-accent"
          >
            confirm all
          </button>
        )}
      </div>
    </div>
  );
}
