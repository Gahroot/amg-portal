/**
 * Utility to detect page context for pre-populating the quick task dialog.
 * Parses the current pathname to infer program ID and other context.
 */

export interface QuickTaskContext {
  programId: string | null;
}

/**
 * Parse the current pathname to extract a program ID if present.
 * Matches paths like /programs/[id] or /programs/[id]/board, etc.
 */
export function detectQuickTaskContext(pathname: string): QuickTaskContext {
  // Match /programs/<uuid>... patterns
  const programMatch = pathname.match(/\/programs\/([a-f0-9-]{36})/i);

  return {
    programId: programMatch?.[1] ?? null,
  };
}
