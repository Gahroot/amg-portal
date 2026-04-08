import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// In development: write alongside the project root in .ezcoder/errors.log
// In production: write to ERROR_LOG_FILE env var path, or default to frontend/errors.log
// Set ERROR_LOG_ENABLED=false to disable file logging entirely (e.g. read-only filesystems).
const DEFAULT_LOG_FILE =
  process.env.NODE_ENV === "development"
    ? path.resolve(process.cwd(), "../.ezcoder/errors.log")
    : path.resolve(process.cwd(), "errors.log");

const LOG_FILE = process.env.ERROR_LOG_FILE
  ? path.resolve(process.env.ERROR_LOG_FILE)
  : DEFAULT_LOG_FILE;

const LOGGING_ENABLED = process.env.ERROR_LOG_ENABLED !== "false";
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB — rotate when exceeded

interface ErrorEntry {
  type: string;
  message: string;
  stack?: string;
  url?: string;
  method?: string;
  status?: number;
  responseBody?: string;
  componentStack?: string;
  source?: string;
  pageUrl?: string;
  timestamp?: string;
  trigger?: string;
  goal?: string;
  breadcrumbs?: string[];
}

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function rotateIfNeeded() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        const rotated = LOG_FILE + ".old";
        if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
        fs.renameSync(LOG_FILE, rotated);
      }
    }
  } catch {
    // ignore rotation errors
  }
}

function formatEntry(entry: ErrorEntry): string {
  const ts = entry.timestamp || new Date().toISOString();
  const separator = "═".repeat(80);
  const parts: string[] = [separator, `[${ts}] ${entry.type || "UNKNOWN"}`];

  // ── WHAT HAPPENED ─────────────────────────────────────────────────────────
  const whatLines: string[] = [];

  let pagePath = entry.pageUrl || "unknown";
  try {
    pagePath = new URL(pagePath).pathname;
  } catch {
    // keep original
  }
  whatLines.push(`  Page:     ${pagePath}`);
  if (entry.trigger) whatLines.push(`  Trigger:  ${entry.trigger}`);
  if (entry.goal) whatLines.push(`  Goal:     ${entry.goal}`);
  if (entry.source) whatLines.push(`  Source:   ${entry.source}`);

  parts.push(`\nWHAT HAPPENED\n${whatLines.join("\n")}`);

  // ── TRAIL ─────────────────────────────────────────────────────────────────
  if (entry.breadcrumbs && entry.breadcrumbs.length > 0) {
    const trail = entry.breadcrumbs
      .map((c, i) =>
        i === entry.breadcrumbs!.length - 1 ? `${c} ← error here` : c
      )
      .join(" → ");
    parts.push(`\nTRAIL\n  ${trail}`);
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  const errorLines: string[] = [];
  if (entry.method && entry.url) {
    errorLines.push(`  Request:  ${entry.method} ${entry.url} → ${entry.status ?? "?"}`);
  }
  const label =
    entry.type === "TOAST_ERROR" ? "Toast (error):" :
    entry.type === "TOAST_WARNING" ? "Toast (warning):" :
    "Message: ";
  errorLines.push(`  ${label}  ${entry.message}`);
  if (entry.responseBody) {
    errorLines.push(`  Response: ${entry.responseBody}`);
  }
  parts.push(`\nERROR\n${errorLines.join("\n")}`);

  // ── STACK ─────────────────────────────────────────────────────────────────
  if (entry.stack || entry.componentStack) {
    const stackLines: string[] = [];
    if (entry.stack) stackLines.push(entry.stack);
    if (entry.componentStack) stackLines.push(`\nComponent Stack:\n${entry.componentStack}`);
    parts.push(`\nSTACK\n${stackLines.join("")}`);
  }

  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  if (!LOGGING_ENABLED) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = (await request.json()) as ErrorEntry | ErrorEntry[];
    const entries = Array.isArray(body) ? body : [body];

    ensureLogDir();
    rotateIfNeeded();

    const lines = entries.map(formatEntry).join("\n\n");

    fs.appendFileSync(LOG_FILE, lines + "\n\n", "utf-8");

    return NextResponse.json({ ok: true, logged: entries.length });
  } catch (e) {
    console.error("Error writing to error log:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
