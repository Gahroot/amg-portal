// Next.js auto-loads this file on server start. Pixel hooks the
// uncaughtExceptionMonitor + unhandledRejection events for API routes,
// Server Components, and route handlers.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const projectKey = process.env.PIXEL_PROJECT_KEY ?? process.env.NEXT_PUBLIC_PIXEL_KEY;
  const ingestUrl = process.env.PIXEL_INGEST_URL ?? process.env.NEXT_PUBLIC_PIXEL_INGEST_URL;

  if (!projectKey || !ingestUrl) {
    return;
  }

  const { initPixel } = await import("@prestyj/pixel");
  // Node entrypoint types require `sink:`; sink takes the URL verbatim
  // (no auto-append), so we explicitly suffix `/ingest` to the base.
  initPixel({
    projectKey,
    sink: { kind: "http", ingestUrl: `${ingestUrl.replace(/\/+$/, "")}/ingest` },
  });
}
