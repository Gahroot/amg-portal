// ── Shared constants and types for bulk deliverable upload ────────────────────

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
];

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

export type FileStatus = "pending" | "uploading" | "success" | "error" | "invalid";

export interface FileQueueItem {
  id: string;
  file: File;
  assignmentId: string;
  title: string;
  notes: string;
  status: FileStatus;
  error: string | null;
  deliverableId: string | null;
  /** Whether the per-file detail panel is open */
  expanded: boolean;
}

export interface PartnerAssignment {
  id: string;
  title: string;
  status: string;
  program_title?: string | null;
}

export { formatBytes } from "@/lib/utils";

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File exceeds the ${MAX_FILE_SIZE_MB} MB size limit`;
  }
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
    return `File type "${file.type}" is not allowed`;
  }
  return null;
}

/**
 * Attempt to auto-match a filename to an assignment by looking for words from
 * the assignment title inside the filename (case-insensitive).
 */
export function autoMatchAssignment(
  filename: string,
  assignments: PartnerAssignment[]
): string {
  const nameLower = filename.toLowerCase().replace(/[^a-z0-9]/g, " ");
  const accepted = assignments.filter((a) => a.status === "accepted");

  let bestId = "";
  let bestScore = 0;

  for (const a of accepted) {
    const words = a.title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3);
    const score = words.filter((w) => nameLower.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = a.id;
    }
  }

  return bestScore > 0 ? bestId : (accepted[0]?.id ?? "");
}
