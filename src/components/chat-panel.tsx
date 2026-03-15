"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import ProposalCard from "@/components/proposal-card";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt", ".docx", ".pptx"];
const ACCEPTED_TYPES = ACCEPTED_EXTENSIONS.join(",");
const GITHUB_REPO_RE = /github\.com\/([^/\s]+\/[^/\s]+)/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ExtractedSource {
  name: string;
  text: string;
}

function readEntriesRecursively(
  entry: FileSystemDirectoryEntry,
): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const reader = entry.createReader();
    const allEntries: FileSystemEntry[] = [];

    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          const promises = allEntries.map((child) => {
            if (child.isFile) {
              return new Promise<File[]>((res, rej) => {
                (child as FileSystemFileEntry).file(
                  (f) => res([f]),
                  (err) => rej(err),
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
          readBatch();
        }
      }, reject);
    };

    readBatch();
  });
}

async function extractFilesFromDrop(
  items: DataTransferItemList,
): Promise<File[]> {
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
        readEntriesRecursively(entry as FileSystemDirectoryEntry),
      );
    }
  }

  const nested = await Promise.all(dirPromises);
  return [...files, ...nested.flat()];
}

function filterByExtension(fileList: FileList | File[]): File[] {
  const valid: File[] = [];
  for (const file of Array.from(fileList)) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (ACCEPTED_EXTENSIONS.includes(ext)) {
      valid.push(file);
    }
  }
  return valid;
}

async function callExtract(
  files: File[],
  repos: string[],
): Promise<ExtractedSource[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("file", file);
  }
  if (repos.length > 0) {
    formData.append("repos", repos.join(","));
  }

  const res = await fetch("/api/extract", { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Extract failed (${res.status})`);
  }

  const data: { sources: ExtractedSource[] } = await res.json();
  return data.sources;
}

function buildContextPrefix(sources: ExtractedSource[]): string {
  const blocks = sources.map(
    (s) => `=== ATTACHED: ${s.name} ===\n${s.text}`,
  );
  return blocks.join("\n\n---\n\n") + "\n\n---\n\n";
}

// ---------------------------------------------------------------------------
// Pending attachment types
// ---------------------------------------------------------------------------

interface PendingFile {
  kind: "file";
  id: string;
  file: File;
}

interface PendingRepo {
  kind: "repo";
  id: string;
  slug: string; // "owner/repo"
}

type PendingAttachment = PendingFile | PendingRepo;

let attachmentIdCounter = 0;
function nextId(): string {
  return `att-${++attachmentIdCounter}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  endpoint: string;
  onStatusChange?: (status: string) => void;
}

export default function ChatPanel({ endpoint, onStatusChange }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [proposalStatuses, setProposalStatuses] = useState<
    Record<string, "pending" | "accepted" | "rejected">
  >({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: endpoint }),
  });

  // Notify parent when status changes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (status !== prevStatusRef.current) {
      prevStatusRef.current = status;
      onStatusChange?.(status);
    }
  }, [status, onStatusChange]);

  const isStreaming = status === "streaming" || status === "submitted";
  const isBusy = isStreaming || uploading;

  // --- Proposal accept/reject handlers ---
  const handleAcceptProposal = useCallback(async (id: string) => {
    setProposalStatuses((prev) => ({ ...prev, [id]: "accepted" }));
    try {
      await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
    } catch {
      // revert on failure
      setProposalStatuses((prev) => ({ ...prev, [id]: "pending" }));
    }
  }, []);

  const handleRejectProposal = useCallback(async (id: string) => {
    setProposalStatuses((prev) => ({ ...prev, [id]: "rejected" }));
    try {
      await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
    } catch {
      // revert on failure
      setProposalStatuses((prev) => ({ ...prev, [id]: "pending" }));
    }
  }, []);

  // --- Close menu on outside click ---
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

  // --- Add files to pending ---
  const addFiles = useCallback((files: File[]) => {
    const valid = filterByExtension(files);
    if (valid.length === 0) return;
    setPending((prev) => [
      ...prev,
      ...valid.map((f): PendingFile => ({ kind: "file", id: nextId(), file: f })),
    ]);
  }, []);

  // --- Detect GitHub URL in input and add as pending repo ---
  const detectRepoInInput = useCallback(
    (value: string): boolean => {
      const match = value.match(GITHUB_REPO_RE);
      if (match) {
        const slug = match[1].replace(/\.git$/, "");
        setPending((prev) => {
          if (prev.some((a) => a.kind === "repo" && a.slug === slug))
            return prev;
          return [...prev, { kind: "repo", id: nextId(), slug }];
        });
        setInput(value.replace(match[0], "").trim());
        return true;
      }
      return false;
    },
    [],
  );

  // --- Remove a pending attachment ---
  const removeAttachment = useCallback((id: string) => {
    setPending((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // --- Drag-and-drop handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const allFiles = await extractFilesFromDrop(e.dataTransfer.items);
        addFiles(allFiles);
      } else if (e.dataTransfer.files.length > 0) {
        addFiles(Array.from(e.dataTransfer.files));
      }
    },
    [addFiles],
  );

  // --- File input change handler ---
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(Array.from(e.target.files));
        e.target.value = "";
      }
    },
    [addFiles],
  );

  // --- Submit ---
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      const attachments = [...pending];

      if (!text && attachments.length === 0) return;
      if (isBusy) return;

      // Clear input immediately for responsiveness
      setInput("");
      setPending([]);

      let finalText = text;

      // If there are pending attachments, extract text first
      if (attachments.length > 0) {
        setUploading(true);
        try {
          const files = attachments
            .filter((a): a is PendingFile => a.kind === "file")
            .map((a) => a.file);
          const repos = attachments
            .filter((a): a is PendingRepo => a.kind === "repo")
            .map((a) => a.slug);

          const sources = await callExtract(files, repos);
          const prefix = buildContextPrefix(sources);
          finalText = prefix + (text || "Analyse the attached sources.");
        } catch (err) {
          // Restore state on failure
          setInput(text);
          setPending(attachments);
          setUploading(false);
          console.error("Extract failed:", err);
          return;
        }
        setUploading(false);
      }

      sendMessage({ text: finalText });
    },
    [input, pending, isBusy, sendMessage],
  );

  // --- Input change with GitHub URL detection ---
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    [],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === " ") {
        setTimeout(() => detectRepoInInput(input + " "), 0);
      }
    },
    [input, detectRepoInInput],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData("text");
      setTimeout(() => detectRepoInInput(input + pasted), 0);
    },
    [input, detectRepoInInput],
  );

  return (
    <div
      className={`relative flex h-full flex-col transition-colors ${
        dragOver ? "bg-foreground/5" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <p className="text-muted">
            Drop files, paste a GitHub URL, or describe your product to get
            started.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-5 ${m.role === "user" ? "text-foreground" : "text-foreground/90"}`}
          >
            <span className="font-medium text-muted">
              {m.role === "user" ? "you" : "copilot"}
            </span>
            <div className="mt-1">
              {m.parts.map((part, i) => { const partKey = `${m.id}-${i}`;
                if (part.type === "text") {
                  // Hide the extracted context prefix from the displayed message
                  const display = part.text.includes("=== ATTACHED:")
                    ? part.text.slice(part.text.lastIndexOf("---\n\n") + 5)
                    : part.text;
                  return (
                    <p key={partKey} className="whitespace-pre-wrap">
                      {display}
                    </p>
                  );
                }
                if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
                  const toolPart = part as {
                    type: string;
                    toolName?: string;
                    state: string;
                    output?: unknown;
                  };
                  const toolName =
                    toolPart.toolName ?? part.type.replace(/^tool-/, "");

                  if (
                    toolPart.state === "input-streaming" ||
                    toolPart.state === "input-available"
                  ) {
                    return (
                      <p key={partKey} className="text-muted italic">
                        {toolName}...
                      </p>
                    );
                  }

                  if (toolPart.state === "output-available") {
                    if (toolName === "generateConjectures") {
                      const raw = toolPart.output;
                      const conjectures = Array.isArray(raw)
                        ? raw
                        : (raw as Record<string, unknown> | undefined)
                              ?.conjectures ?? [];
                      return (
                        <div key={partKey} className="mt-2 flex flex-col gap-2">
                          {(
                            conjectures as Array<{
                              id: string;
                              summary: string;
                              reasoning?: string;
                              sectorLabel?: string;
                              status?: string;
                            }>
                          ).map((c) => (
                            <ProposalCard
                              key={c.id}
                              id={c.id}
                              title={c.sectorLabel ?? c.summary}
                              summary={c.summary}
                              reasoning={c.reasoning}
                              status={
                                proposalStatuses[c.id] ??
                                (c.status as
                                  | "pending"
                                  | "accepted"
                                  | "rejected") ??
                                "pending"
                              }
                              onAccept={handleAcceptProposal}
                              onReject={handleRejectProposal}
                            />
                          ))}
                        </div>
                      );
                    }

                    if (toolName === "updatePPRField") {
                      const result = toolPart.output as
                        | Record<string, unknown>
                        | undefined;
                      const field = result?.field;
                      return (
                        <p key={partKey} className="text-muted">
                          updated{field ? ` ${String(field)}` : ""}
                        </p>
                      );
                    }

                    if (toolName === "runDeepResearch") {
                      const result = toolPart.output as
                        | Record<string, unknown>
                        | undefined;
                      return (
                        <div
                          key={partKey}
                          className="mt-2 rounded border border-solid border-divider bg-surface px-4 py-3"
                        >
                          <p className="font-medium text-foreground">
                            research complete
                          </p>
                          {result?.summary != null && (
                            <p className="mt-1 text-muted">
                              {String(result.summary)}
                            </p>
                          )}
                        </div>
                      );
                    }

                    // fallback for other completed tool calls
                    return null;
                  }

                  // output-error, approval states, etc.
                  return null;
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {isStreaming && (
          <span className="inline-block h-3 w-1 animate-pulse bg-foreground" />
        )}
        {uploading && (
          <div className="mb-5 flex items-center gap-2 text-muted">
            <span className="inline-block h-3 w-1 animate-pulse bg-accent" />
            extracting attached sources...
          </div>
        )}
      </div>

      {/* Pending attachments */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-solid border-divider px-6 py-3">
          {pending.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1.5 rounded border border-solid border-accent/30 bg-surface px-3 py-1 font-mono text-foreground"
            >
              {att.kind === "file" ? (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {att.file.name}
                </>
              ) : (
                <>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  </svg>
                  {att.slug}
                </>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="ml-0.5 cursor-pointer border-none bg-transparent p-0 text-divider hover:text-foreground"
                aria-label={`Remove ${att.kind === "file" ? att.file.name : att.slug}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-t-2 border-solid border-divider bg-surface px-6 py-4"
      >
        {/* Upload button with menu */}
        <div className="relative shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            disabled={isBusy}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Attach files or folder"
          >
            <svg
              width="20"
              height="20"
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
              className="absolute bottom-full left-0 z-10 mb-1 flex flex-col border border-solid border-divider bg-background text-[length:inherit]"
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

        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onPaste={handlePaste}
          placeholder="describe your product, drop files, or paste a github url..."
          disabled={isBusy}
          className="min-w-0 flex-1 border-none bg-transparent font-mono text-[length:inherit] leading-[inherit] text-foreground outline-none placeholder:text-muted"
        />

        {/* Send button — visible when there's content to send */}
        {(input.trim() || pending.length > 0) && (
          <button
            type="submit"
            disabled={isBusy}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </form>

      {/* Hidden file inputs */}
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

      {/* Drag overlay hint */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-foreground/30 bg-foreground/5">
          <p className="font-mono text-[length:inherit] text-divider">drop files here</p>
        </div>
      )}
    </div>
  );
}
