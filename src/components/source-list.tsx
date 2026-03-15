"use client";

type Source = {
  id: string;
  name: string;
  type: "file" | "repo";
  size?: number;
};

interface SourceListProps {
  sources: Source[];
  onRemove: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SourceList({ sources, onRemove }: SourceListProps) {
  if (sources.length === 0) return null;

  return (
    <div className="w-full max-w-content font-mono text-sm">
      {sources.map((source, index) => {
        const isLast = index === sources.length - 1;
        const connector = isLast ? "└── " : "├── ";

        return (
          <div
            key={source.id}
            className="group flex items-center py-0.5 text-divider"
          >
            <span className="text-divider select-none">{connector}</span>
            <span className="flex-1">
              {source.name}
              {source.type === "file" && source.size != null && (
                <span> — {formatSize(source.size)}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onRemove(source.id)}
              className="cursor-pointer border-none bg-transparent p-0 text-divider opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
