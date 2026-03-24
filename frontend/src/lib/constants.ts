/** Backend API base URL — used for authenticated server-side exports. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Role display labels mapping role keys to human-readable names.
 */
export const ROLE_LABELS: Record<string, string> = {
  managing_director: "Managing Director",
  relationship_manager: "Relationship Manager",
  coordinator: "Coordinator",
  finance_compliance: "Finance & Compliance",
  client: "Client",
  partner: "Partner",
};

/**
 * Role options for select dropdowns.
 */
export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
