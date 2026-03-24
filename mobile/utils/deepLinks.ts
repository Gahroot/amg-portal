/**
 * Deep link parsing utilities for push notifications.
 *
 * Deep link structure:
 * - amgportal://programs/{id}
 * - amgportal://messages/{id}
 * - amgportal://decisions/{id}
 */

export type DeepLinkType = 'programs' | 'messages' | 'decisions' | 'unknown';

export interface ParsedDeepLink {
  type: DeepLinkType;
  id: string;
  isValid: boolean;
  route?: string;
}

const DEEP_LINK_SCHEME = 'amgportal://';

/**
 * Supported deep link paths and their route mappings.
 */
const DEEP_LINK_ROUTES: Record<string, (id: string) => string> = {
  programs: (id) => `/(client)/programs/${id}`,
  messages: (id) => `/(client)/messages?conversationId=${id}`,
  decisions: (id) => `/(client)/decisions/${id}`,
};

/**
 * Parse a deep link URL and extract type and ID.
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  if (!url || typeof url !== 'string') {
    return { type: 'unknown', id: '', isValid: false };
  }

  // Handle both full URLs and relative paths
  let normalizedUrl = url;

  // If it's a deep link URL, parse it
  if (url.startsWith(DEEP_LINK_SCHEME)) {
    normalizedUrl = url.slice(DEEP_LINK_SCHEME.length);
  } else if (url.startsWith('/')) {
    // Handle web-style paths (e.g., /programs/123)
    normalizedUrl = url.slice(1);
  }

  // Split the path into segments
  const segments = normalizedUrl.split('/').filter(Boolean);

  if (segments.length < 2) {
    return { type: 'unknown', id: '', isValid: false };
  }

  const [type, id] = segments;

  // Validate the type
  if (type !== 'programs' && type !== 'messages' && type !== 'decisions') {
    return { type: 'unknown', id: '', isValid: false };
  }

  // Validate the ID (basic UUID or numeric check)
  const isValidId = id && id.length > 0;
  if (!isValidId) {
    return { type: type as DeepLinkType, id: '', isValid: false };
  }

  const route = DEEP_LINK_ROUTES[type]?.(id);

  return {
    type: type as DeepLinkType,
    id,
    isValid: true,
    route,
  };
}

/**
 * Generate a deep link URL from type and ID.
 */
export function generateDeepLink(type: DeepLinkType, id: string): string {
  if (type === 'unknown' || !id) {
    return '';
  }
  return `${DEEP_LINK_SCHEME}${type}/${id}`;
}

/**
 * Convert a web action URL to a mobile deep link.
 * E.g., /programs/123 -> amgportal://programs/123
 */
export function webUrlToDeepLink(actionUrl: string | null | undefined): string {
  if (!actionUrl) {
    return '';
  }

  // If already a deep link, return as-is
  if (actionUrl.startsWith(DEEP_LINK_SCHEME)) {
    return actionUrl;
  }

  // Parse the web URL and convert
  const parsed = parseDeepLink(actionUrl);
  if (parsed.isValid) {
    return generateDeepLink(parsed.type, parsed.id);
  }

  return '';
}

/**
 * Get the expo-router route from a deep link.
 */
export function getRouteFromDeepLink(url: string): string | null {
  const parsed = parseDeepLink(url);
  return parsed.route || null;
}

/**
 * Entity type to deep link type mapping.
 */
const ENTITY_TYPE_MAP: Record<string, DeepLinkType> = {
  program: 'programs',
  programs: 'programs',
  message: 'messages',
  messages: 'messages',
  conversation: 'messages',
  conversations: 'messages',
  decision: 'decisions',
  decisions: 'decisions',
};

/**
 * Get deep link type from entity type.
 */
export function getDeepLinkTypeFromEntity(entityType: string | null | undefined): DeepLinkType {
  if (!entityType) {
    return 'unknown';
  }
  return ENTITY_TYPE_MAP[entityType.toLowerCase()] || 'unknown';
}

/**
 * Create a deep link from entity type and ID.
 */
export function createDeepLinkFromEntity(
  entityType: string | null | undefined,
  entityId: string | null | undefined
): string {
  if (!entityType || !entityId) {
    return '';
  }

  const linkType = getDeepLinkTypeFromEntity(entityType);
  if (linkType === 'unknown') {
    return '';
  }

  return generateDeepLink(linkType, entityId);
}
