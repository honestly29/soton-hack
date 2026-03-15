"use client";

import { useState, useCallback } from "react";
import SourceInput from "@/components/source-input";
import SourceList from "@/components/source-list";

type Source = {
  id: string;
  name: string;
  type: "file" | "repo";
  size?: number;
};

export default function Home() {
  const [sources, setSources] = useState<Source[]>([]);
  const [driveClicked, setDriveClicked] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    const newSources: Source[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      type: "file" as const,
      size: f.size,
    }));
    setSources((prev) => [...prev, ...newSources]);
  }, []);

  const addRepo = useCallback((name: string) => {
    setSources((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, type: "repo" as const },
    ]);
  }, []);

  const removeSource = useCallback((id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const hasSources = sources.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-content flex-col items-center gap-rhythm">
        <SourceInput onFilesAdded={addFiles} onRepoAdded={addRepo} />

        <button
          type="button"
          onClick={() => setDriveClicked(true)}
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-[length:inherit] leading-[inherit] text-divider transition-colors hover:text-foreground"
        >
          {driveClicked ? "coming soon." : "connect google drive"}
        </button>

        <SourceList sources={sources} onRemove={removeSource} />

        <span
          className={`select-none ${
            hasSources
              ? "cursor-pointer text-foreground"
              : "text-divider"
          }`}
        >
          continue →
        </span>
      </div>
    </div>
  );
}
