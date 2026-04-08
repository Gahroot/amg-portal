/**
 * action-context.ts
 *
 * Singleton action tracker — no React dependency.
 * Captures the last interactive element clicked, infers the user's goal,
 * and maintains a rolling 5-entry breadcrumb trail of what the user did.
 *
 * Safe in SSR: all window/document access is guarded.
 */

const MAX_CRUMBS = 5;
const CRUMB_TTL_MS = 30_000; // 30 s — stale crumbs are discarded

interface Crumb {
  label: string;
  ts: number;
}

// ─── Module-level state ───────────────────────────────────────────────────────

let lastTrigger: string | null = null;
let lastGoal: string | null = null;
const crumbs: Crumb[] = [];

// ─── Label extraction ─────────────────────────────────────────────────────────

const INTERACTIVE_SELECTORS =
  'button, a, [role="button"], [role="menuitem"], input[type="submit"], input[type="button"]';

function extractLabel(el: Element): string {
  // Walk up the DOM to the nearest interactive element
  const target = el.closest(INTERACTIVE_SELECTORS) ?? el;
  const htmlEl = target as HTMLElement;

  // Priority: data-action → aria-label → textContent → placeholder → tag name
  if (htmlEl.dataset?.action) return htmlEl.dataset.action.trim().slice(0, 60);
  if (htmlEl.getAttribute("aria-label"))
    return htmlEl.getAttribute("aria-label")!.trim().slice(0, 60);

  const text = htmlEl.textContent?.trim().replace(/\s+/g, " ");
  if (text) return text.slice(0, 60);

  if (htmlEl instanceof HTMLInputElement && htmlEl.placeholder)
    return htmlEl.placeholder.trim().slice(0, 60);

  return htmlEl.tagName.toLowerCase();
}

// ─── Goal inference ───────────────────────────────────────────────────────────

function inferGoal(el: Element, label: string): string {
  const htmlEl = el.closest(INTERACTIVE_SELECTORS) as HTMLElement | null;

  // Explicit override from data-goal attribute
  if (htmlEl?.dataset?.goal) return htmlEl.dataset.goal.trim();

  const lower = label.toLowerCase();

  if (/save|create|add|submit|new/.test(lower)) return `Create or save: "${label}"`;
  if (/delete|remove|archive/.test(lower)) return `Delete or remove: "${label}"`;
  if (/approve|confirm/.test(lower)) return `Approve/confirm: "${label}"`;
  if (/edit|update/.test(lower)) return `Update: "${label}"`;
  if (/send|email|notify/.test(lower)) return `Send communication: "${label}"`;
  if (/upload|import/.test(lower)) return `Upload/import: "${label}"`;
  if (/download|export/.test(lower)) return `Download/export: "${label}"`;

  return `Complete action: "${label}"`;
}

// ─── Breadcrumb helpers ───────────────────────────────────────────────────────

function pushCrumb(label: string) {
  const now = Date.now();

  // Drop crumbs older than the TTL
  while (crumbs.length > 0 && now - crumbs[0].ts > CRUMB_TTL_MS) {
    crumbs.shift();
  }

  crumbs.push({ label, ts: now });

  // Keep only the last MAX_CRUMBS entries
  if (crumbs.length > MAX_CRUMBS) crumbs.shift();
}

function activeCrumbs(): string[] {
  const now = Date.now();
  return crumbs.filter((c) => now - c.ts <= CRUMB_TTL_MS).map((c) => c.label);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function recordClick(el: Element): void {
  const label = extractLabel(el);
  lastTrigger = label;
  lastGoal = inferGoal(el, label);
  pushCrumb(`Clicked "${label}"`);
}

export function recordNavigation(url: string): void {
  let pathname = url;
  try {
    pathname = new URL(url, "http://x").pathname;
  } catch {
    // keep original
  }
  pushCrumb(`Navigated to ${pathname}`);
}

export interface ActionContext {
  trigger: string | null;
  goal: string | null;
  breadcrumbs: string[];
}

export function getActionContext(): ActionContext {
  return {
    trigger: lastTrigger,
    goal: lastGoal,
    breadcrumbs: activeCrumbs(),
  };
}
