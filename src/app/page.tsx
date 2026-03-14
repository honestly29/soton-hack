"use client";

import { useState, useCallback } from "react";
import FileDropZone from "@/components/file-drop-zone";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <FileDropZone onFilesAdded={addFiles} />
    </div>
  );
}
