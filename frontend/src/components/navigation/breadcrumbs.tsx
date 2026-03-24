"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Home } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  dashboardSegments,
  portalSegments,
  partnerSegments,
  type BreadcrumbSegmentConfig,
} from "@/components/navigation/breadcrumb-config";

type PortalType = "dashboard" | "portal" | "partner";

interface BreadcrumbsProps {
  /** Which portal context we are in */
  portal: PortalType;
}

interface BreadcrumbEntry {
  label: string;
  href: string;
  /** Config key used for the lookup (for resolver caching) */
  configKey: string;
  /** The dynamic ID value, if this segment is dynamic */
  dynamicId?: string;
  /** Whether this is the last (current page) segment */
  isLast: boolean;
}

/** Strip the portal prefix from a pathname and return the remaining segments. */
function getSegments(pathname: string, portal: PortalType): string[] {
  let stripped = pathname;
  if (portal === "portal") {
    stripped = pathname.replace(/^\/portal\/?/, "");
  } else if (portal === "partner") {
    stripped = pathname.replace(/^\/partner\/?/, "");
  } else {
    // Dashboard: strip leading "/"
    stripped = pathname.replace(/^\//, "");
  }
  return stripped ? stripped.split("/") : [];
}

function getSegmentMap(portal: PortalType) {
  switch (portal) {
    case "portal":
      return portalSegments;
    case "partner":
      return partnerSegments;
    default:
      return dashboardSegments;
  }
}

function getHomeHref(portal: PortalType) {
  switch (portal) {
    case "portal":
      return "/portal/dashboard";
    case "partner":
      return "/partner";
    default:
      return "/";
  }
}

/**
 * Determine whether a path segment looks like a dynamic ID.
 * UUIDs, numeric IDs, and year-like values are considered dynamic.
 */
function looksLikeDynamicId(segment: string): boolean {
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
  // Numeric
  if (/^\d+$/.test(segment)) return true;
  return false;
}

/**
 * Build the breadcrumb entries from the current path segments using config lookups.
 *
 * Algorithm:
 *  1. Walk the path segments left-to-right.
 *  2. For each segment, try progressively longer config keys that match.
 *  3. If a segment looks like a dynamic ID, replace it with [id] in the key.
 */
function buildEntries(
  pathSegments: string[],
  segmentMap: Record<string, BreadcrumbSegmentConfig>,
  portal: PortalType,
): BreadcrumbEntry[] {
  const entries: BreadcrumbEntry[] = [];
  const prefix = portal === "portal" ? "/portal" : portal === "partner" ? "/partner" : "";

  // Build a normalized pattern key by walking segments
  const patternParts: string[] = [];

  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    const isDynamic = looksLikeDynamicId(segment);

    if (isDynamic) {
      patternParts.push("[id]");
    } else {
      patternParts.push(segment);
    }

    const configKey = patternParts.join("/");
    const config = segmentMap[configKey];

    if (!config) {
      // If we can't find a match at all, try to see if there's a combined key
      // (e.g. "documents/vault" where "documents" alone isn't in the map)
      // We skip emitting a crumb for intermediate unmatched segments,
      // but we'll pick them up when the full key matches.
      continue;
    }

    const href = prefix + "/" + pathSegments.slice(0, i + 1).join("/");

    entries.push({
      label: config.label,
      href,
      configKey,
      dynamicId: isDynamic ? segment : undefined,
      isLast: i === pathSegments.length - 1,
    });
  }

  return entries;
}

/** Hook to resolve a dynamic breadcrumb label via API */
function useDynamicLabel(
  config: BreadcrumbSegmentConfig | undefined,
  dynamicId: string | undefined,
  configKey: string,
): string | undefined {
  const { data } = useQuery({
    queryKey: ["breadcrumb", configKey, dynamicId],
    queryFn: () => config!.resolve!(dynamicId!),
    enabled: !!config?.resolve && !!dynamicId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  return data;
}

/**
 * Individual breadcrumb segment that may resolve its label dynamically.
 */
function BreadcrumbSegment({
  entry,
  segmentMap,
}: {
  entry: BreadcrumbEntry;
  segmentMap: Record<string, BreadcrumbSegmentConfig>;
}) {
  const config = segmentMap[entry.configKey];
  const resolvedLabel = useDynamicLabel(config, entry.dynamicId, entry.configKey);
  const label = resolvedLabel ?? entry.label;

  // Truncate long names
  const displayLabel = label.length > 32 ? label.slice(0, 30) + "…" : label;

  if (entry.isLast) {
    return (
      <BreadcrumbItem>
        <BreadcrumbPage title={label}>{displayLabel}</BreadcrumbPage>
      </BreadcrumbItem>
    );
  }

  return (
    <BreadcrumbItem>
      <BreadcrumbLink asChild>
        <Link href={entry.href} title={label}>
          {displayLabel}
        </Link>
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}

export function Breadcrumbs({ portal }: BreadcrumbsProps) {
  const pathname = usePathname();
  const segmentMap = getSegmentMap(portal);
  const homeHref = getHomeHref(portal);

  const pathSegments = useMemo(() => getSegments(pathname, portal), [pathname, portal]);
  const entries = useMemo(
    () => buildEntries(pathSegments, segmentMap, portal),
    [pathSegments, segmentMap, portal],
  );

  // Don't render breadcrumbs on the home/dashboard page
  if (entries.length === 0) return null;

  // Don't render if we're on a single top-level page (e.g. /programs list)
  // that doesn't have children — breadcrumbs only add value for nested routes
  if (entries.length === 1 && !entries[0].dynamicId) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={homeHref}>
              <Home className="size-3.5" />
              <span className="sr-only">Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {entries.map((entry) => (
          <Fragment key={entry.configKey}>
            <BreadcrumbSeparator />
            <BreadcrumbSegment entry={entry} segmentMap={segmentMap} />
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
