/**
 * DataCache - Persistent cache service for offline data access
 * Uses AsyncStorage for data persistence with TTL support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@amg_cache_';
const CACHE_METADATA_KEY = '@amg_cache_metadata';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheMetadata {
  [key: string]: {
    cachedAt: number;
    expiresAt: number;
    size: number;
  };
}

// Default cache expiry times (in milliseconds)
export const CACHE_TTL = {
  PROGRAMS: 30 * 60 * 1000, // 30 minutes
  PROGRAM_DETAIL: 30 * 60 * 1000, // 30 minutes
  CLIENTS: 60 * 60 * 1000, // 1 hour
  CLIENT_DETAIL: 60 * 60 * 1000, // 1 hour
  DOCUMENTS: 60 * 60 * 1000, // 1 hour
  MESSAGES: 5 * 60 * 1000, // 5 minutes
  DASHBOARD: 15 * 60 * 1000, // 15 minutes
  DEFAULT: 30 * 60 * 1000, // 30 minutes
} as const;

class DataCacheService {
  private metadata: CacheMetadata = {};

  /**
   * Initialize cache - load metadata
   */
  async initialize(): Promise<void> {
    try {
      const metadataJson = await AsyncStorage.getItem(CACHE_METADATA_KEY);
      if (metadataJson) {
        this.metadata = JSON.parse(metadataJson);
      }
    } catch (error) {
      console.error('Failed to initialize cache metadata:', error);
      this.metadata = {};
    }
  }

  /**
   * Get a cache key with prefix
   */
  private getKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * Store data in cache
   */
  async set<T>(key: string, data: T, ttl: number = CACHE_TTL.DEFAULT): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    };

    try {
      const serialized = JSON.stringify(entry);
      await AsyncStorage.setItem(this.getKey(key), serialized);

      // Update metadata
      this.metadata[key] = {
        cachedAt: now,
        expiresAt: entry.expiresAt,
        size: serialized.length,
      };
      await this.saveMetadata();
    } catch (error) {
      console.error(`Failed to cache data for key "${key}":`, error);
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(key));
      if (!serialized) return null;

      const entry: CacheEntry<T> = JSON.parse(serialized);

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`Failed to get cached data for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Get cached data even if expired (for offline fallback)
   */
  async getStale<T>(key: string): Promise<T | null> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(key));
      if (!serialized) return null;

      const entry: CacheEntry<T> = JSON.parse(serialized);
      return entry.data;
    } catch (error) {
      console.error(`Failed to get stale cached data for key "${key}":`, error);
      return null;
    }
  }

  /**
   * Check if cached data exists and is fresh
   */
  async has(key: string): Promise<boolean> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(key));
      if (!serialized) return false;

      const entry: CacheEntry<unknown> = JSON.parse(serialized);
      return Date.now() <= entry.expiresAt;
    } catch {
      return false;
    }
  }

  /**
   * Check if cached data exists (even if stale)
   */
  async hasStale(key: string): Promise<boolean> {
    try {
      const serialized = await AsyncStorage.getItem(this.getKey(key));
      return serialized !== null;
    } catch {
      return false;
    }
  }

  /**
   * Remove a specific cache entry
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getKey(key));
      delete this.metadata[key];
      await this.saveMetadata();
    } catch (error) {
      console.error(`Failed to remove cache for key "${key}":`, error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.getCacheKeys();
      await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));
      this.metadata = {};
      await this.saveMetadata();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Clear expired cache entries
   */
  async clearExpired(): Promise<void> {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (const [key, meta] of Object.entries(this.metadata)) {
        if (now > meta.expiresAt) {
          keysToRemove.push(this.getKey(key));
          delete this.metadata[key];
        }
      }

      if (keysToRemove.length > 0) {
        await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));
        await this.saveMetadata();
      }
    } catch (error) {
      console.error('Failed to clear expired cache:', error);
    }
  }

  /**
   * Get all cache keys (with prefix)
   */
  private async getCacheKeys(): Promise<string[]> {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys.filter((k: string) => k.startsWith(CACHE_PREFIX));
  }

  /**
   * Save metadata to storage
   */
  private async saveMetadata(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(this.metadata));
    } catch (error) {
      console.error('Failed to save cache metadata:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    entryCount: number;
    totalSize: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    const entries = Object.values(this.metadata);
    const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    const timestamps = entries.map((e) => e.cachedAt);

    return {
      entryCount: entries.length,
      totalSize,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  /**
   * Get cache info for a specific key
   */
  getCacheInfo(key: string): { cachedAt: number; expiresAt: number; isExpired: boolean } | null {
    const meta = this.metadata[key];
    if (!meta) return null;

    return {
      cachedAt: meta.cachedAt,
      expiresAt: meta.expiresAt,
      isExpired: Date.now() > meta.expiresAt,
    };
  }
}

// Export singleton instance
export const dataCache = new DataCacheService();
