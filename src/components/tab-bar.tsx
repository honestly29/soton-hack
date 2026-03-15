"use client";

export type TabId = "chat" | "surfaces" | "hypotheses" | "people";

export type TabState = "active" | "locked" | "updating";

export interface TabDef {
  id: TabId;
  label: string;
  state: TabState;
}

interface TabBarProps {
  tabs: TabDef[];
  current: TabId;
  onSelect: (id: TabId) => void;
}

export default function TabBar({ tabs, current, onSelect }: TabBarProps) {
  return (
    <nav className="flex gap-0 border-b-2 border-solid border-divider bg-surface px-2">
      {tabs.map((tab) => {
        const isCurrent = tab.id === current;
        const isLocked = tab.state === "locked";
        const isUpdating = tab.state === "updating";

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => !isLocked && onSelect(tab.id)}
            disabled={isLocked}
            className={`relative border-none bg-transparent px-5 py-4 font-mono text-[length:inherit] font-medium transition-colors ${
              isLocked
                ? "cursor-not-allowed text-divider"
                : isCurrent
                  ? "cursor-default text-foreground"
                  : "cursor-pointer text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {isUpdating && (
              <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
            )}
            {isCurrent && (
              <span className="absolute bottom-[-2px] left-2 right-2 h-0.5 bg-foreground" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
