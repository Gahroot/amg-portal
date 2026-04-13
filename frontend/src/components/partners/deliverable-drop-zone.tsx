"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB } from "./deliverable-upload-types";

interface DeliverableDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function DeliverableDropZone({ onFilesSelected, disabled = false }: DeliverableDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <CloudUpload className="mb-4 h-12 w-12 text-muted-foreground" />
      <p className="text-base font-medium">
        {isDragging ? "Drop files here" : "Drag & drop files here"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        or click to select multiple files
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {ALLOWED_EXTENSIONS.join(", ")} · Max {MAX_FILE_SIZE_MB} MB per file
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
