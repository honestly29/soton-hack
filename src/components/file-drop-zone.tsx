"use client";

import { useCallback, useRef, useState } from "react";

const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt", ".docx", ".pptx"];
const ACCEPTED_TYPES = ACCEPTED_EXTENSIONS.join(",");

interface FileDropZoneProps {
  onFilesAdded: (files: File[]) => void;
}

export default function FileDropZone({ onFilesAdded }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filterFiles = useCallback((fileList: FileList) => {
    const valid: File[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (ACCEPTED_EXTENSIONS.includes(ext)) {
        valid.push(file);
      }
    }
    return valid;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        const valid = filterFiles(e.dataTransfer.files);
        if (valid.length > 0) onFilesAdded(valid);
      }
    },
    [filterFiles, onFilesAdded]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const valid = filterFiles(e.target.files);
        if (valid.length > 0) onFilesAdded(valid);
        e.target.value = "";
      }
    },
    [filterFiles, onFilesAdded]
  );

  return (
    <div className="w-full max-w-content">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        className={`flex cursor-pointer items-center justify-between border border-solid px-5 py-4 transition-colors select-none ${
          dragOver
            ? "border-foreground text-foreground"
            : "border-divider text-divider"
        }`}
      >
        <span>drop files here, or click to browse</span>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-8l-2-3Z" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
