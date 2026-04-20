"use client";

import { create } from "zustand";

// An in-memory cache of valid step-up tokens, keyed by action scope.
// Entries expire slightly before their actual TTL so race conditions
// with the server don't surface as unexpected 401s.
const SKEW_SECONDS = 10;

interface CachedToken {
  token: string;
  expires_at: number; // epoch seconds
}

interface StepUpState {
  tokens: Record<string, CachedToken>;
  pendingAction: string | null;
  resolvePrompt: ((token: string | null) => void) | null;

  getValidToken: (action: string) => string | null;
  cacheToken: (actions: string[], token: string, ttlSeconds: number) => void;

  requestToken: (action: string) => Promise<string | null>;
  fulfillPrompt: (token: string | null) => void;

  clear: () => void;
}

export const useStepUpStore = create<StepUpState>((set, get) => ({
  tokens: {},
  pendingAction: null,
  resolvePrompt: null,

  getValidToken: (action) => {
    const entry = get().tokens[action];
    if (!entry) return null;
    if (Date.now() / 1000 > entry.expires_at - SKEW_SECONDS) {
      return null;
    }
    return entry.token;
  },

  cacheToken: (actions, token, ttlSeconds) => {
    const expires_at = Date.now() / 1000 + ttlSeconds;
    const next: Record<string, CachedToken> = { ...get().tokens };
    for (const a of actions) {
      next[a] = { token, expires_at };
    }
    set({ tokens: next });
  },

  requestToken: (action) => {
    return new Promise<string | null>((resolve) => {
      const existing = get().getValidToken(action);
      if (existing) {
        resolve(existing);
        return;
      }
      set({
        pendingAction: action,
        resolvePrompt: (t) => resolve(t),
      });
    });
  },

  fulfillPrompt: (token) => {
    const { resolvePrompt } = get();
    set({ pendingAction: null, resolvePrompt: null });
    if (resolvePrompt) resolvePrompt(token);
  },

  clear: () => set({ tokens: {}, pendingAction: null, resolvePrompt: null }),
}));
