"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt", ".docx", ".pptx"];
const ACCEPTED_TYPES = ACCEPTED_EXTENSIONS.join(",");
const GITHUB_REPO_RE = /github\.com\/([^/]+\/[^/]+)/;

function readEntriesRecursively(
  entry: FileSystemDirectoryEntry
): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const reader = entry.createReader();
    const allEntries: FileSystemEntry[] = [];

    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          // All entries read — now process them
          const promises = allEntries.map((child) => {
            if (child.isFile) {
              return new Promise<File[]>((res, rej) => {
                (child as FileSystemFileEntry).file(
                  (f) => res([f]),
                  (err) => rej(err)
                );
              });
            }
            return readEntriesRecursively(child as FileSystemDirectoryEntry);
          });
          Promise.all(promises)
            .then((nested) => resolve(nested.flat()))
            .catch(reject);
        } else {
          allEntries.push(...entries);
          readBatch(); // readEntries returns max ~100 per call
        }
      }, reject);
    };

    readBatch();
  });
}

async function extractFiles(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const dirPromises: Promise<File[]>[] = [];

  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (!entry) continue;
    if (entry.isFile) {
      const file = items[i].getAsFile();
      if (file) files.push(file);
    } else if (entry.isDirectory) {
      dirPromises.push(
        readEntriesRecursively(entry as FileSystemDirectoryEntry)
      );
    }
  }

  const nested = await Promise.all(dirPromises);
  return [...files, ...nested.flat()];
}

interface SourceInputProps {
  onFilesAdded: (files: File[]) => void;
  onRepoAdded: (name: string) => void;
}

export default function SourceInput({
  onFilesAdded,
  onRepoAdded,
}: SourceInputProps) {
  const [dragOver, setDragOver] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const filterFiles = useCallback((fileList: FileList | File[]) => {
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
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const allFiles = await extractFiles(e.dataTransfer.items);
        const valid = filterFiles(allFiles);
        if (valid.length > 0) onFilesAdded(valid);
      } else if (e.dataTransfer.files.length > 0) {
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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        const valid = filterFiles(e.target.files);
        if (valid.length > 0) onFilesAdded(valid);
        e.target.value = "";
      }
    },
    [filterFiles, onFilesAdded]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const match = urlValue.match(GITHUB_REPO_RE);
        if (match) {
          onRepoAdded(match[1]);
          setUrlValue("");
        }
      }
    },
    [urlValue, onRepoAdded]
  );

  const active = dragOver;

  return (
    <div className="w-full max-w-content">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex items-center justify-between border border-solid px-6 py-8 transition-colors ${
          active
            ? "border-foreground text-foreground"
            : "border-divider text-divider"
        }`}
      >
        <input
          type="text"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="drop files or paste a github url"
          className="flex-1 border-none bg-transparent font-mono text-[length:inherit] leading-[inherit] text-inherit outline-none placeholder:text-inherit"
        />
        <div className="relative ml-4 shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-inherit"
            aria-label="Upload files or folder"
          >
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
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full z-10 mt-1 flex flex-col border border-solid border-divider bg-background"
            >
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setMenuOpen(false);
                }}
                className="cursor-pointer whitespace-nowrap border-none bg-transparent px-4 py-2 text-left font-mono text-foreground hover:bg-divider"
              >
                Files
              </button>
              <button
                type="button"
                onClick={() => {
                  folderInputRef.current?.click();
                  setMenuOpen(false);
                }}
                className="cursor-pointer whitespace-nowrap border-none bg-transparent px-4 py-2 text-left font-mono text-foreground hover:bg-divider"
              >
                Folder
              </button>
            </div>
          )}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ webkitdirectory: "" } as any)}
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
