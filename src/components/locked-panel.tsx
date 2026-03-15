"use client";

interface LockedPanelProps {
  label: string;
  reason: string;
}

export default function LockedPanel({ label, reason }: LockedPanelProps) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-medium text-divider">{label}</p>
        <p className="mt-2 text-muted">{reason}</p>
      </div>
    </div>
  );
}
