"use client";
// Client-only pixel init. Rendered from the root layout. The "use client"
// directive guarantees this module never executes during server-side
// rendering — `window.onerror` references would otherwise crash builds.
import { useEffect } from "react";
import { initPixel } from "@prestyj/pixel/browser";

let inited = false;

export default function GGPixelClient() {
  useEffect(() => {
    if (inited) return;
    const projectKey = process.env.NEXT_PUBLIC_PIXEL_KEY;
    const ingestUrl = process.env.NEXT_PUBLIC_PIXEL_INGEST_URL;
    if (!projectKey || !ingestUrl) return;
    inited = true;
    initPixel({ projectKey, ingestUrl });
  }, []);
  return null;
}
