import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAccessToken,
  setTokens,
  removeTokens,
  getRefreshToken,
} from "@/lib/token-storage";

// Helper to clear all cookies in jsdom
function clearAllCookies() {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name] = cookie.trim().split("=");
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
}

describe("token-storage", () => {
  beforeEach(() => {
    clearAllCookies();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearAllCookies();
  });

  // ---- getAccessToken ----

  describe("getAccessToken", () => {
    it("returns null when no session cookie exists", () => {
      expect(getAccessToken()).toBeNull();
    });

    it("returns sentinel '__cookie__' when has_session=1 cookie exists", () => {
      document.cookie = "has_session=1; path=/";
      const result = getAccessToken();
      expect(result).toBe("__cookie__");
    });

    it("returns null when has_session cookie has different value", () => {
      document.cookie = "has_session=0; path=/";
      const result = getAccessToken();
      // The implementation checks for "has_session=1" specifically
      expect(result).toBeNull();
    });

    it("returns string type when session exists", () => {
      document.cookie = "has_session=1; path=/";
      expect(typeof getAccessToken()).toBe("string");
    });

    it("returns null type when no session exists", () => {
      expect(getAccessToken()).toBeNull();
    });

    it("is not undefined in jsdom environment", () => {
      expect(getAccessToken()).not.toBeUndefined();
    });
  });

  // ---- setTokens ----

  describe("setTokens", () => {
    it("sets the has_session=1 cookie", () => {
      setTokens("access-token", "refresh-token");
      expect(document.cookie).toContain("has_session=1");
    });

    it("makes getAccessToken return sentinel after setting tokens", () => {
      setTokens("my-access", "my-refresh");
      expect(getAccessToken()).toBe("__cookie__");
    });

    it("accepts any access and refresh token strings", () => {
      // The actual tokens are ignored (httpOnly cookies managed by server)
      expect(() => setTokens("token-a", "token-b")).not.toThrow();
    });

    it("can be called multiple times without error", () => {
      setTokens("token1", "refresh1");
      setTokens("token2", "refresh2");
      expect(getAccessToken()).toBe("__cookie__");
    });
  });

  // ---- removeTokens ----

  describe("removeTokens", () => {
    it("can be called without error when no session exists", () => {
      expect(() => removeTokens()).not.toThrow();
    });

    it("clears the session so getAccessToken returns null", () => {
      // Set a session first
      setTokens("access", "refresh");
      expect(getAccessToken()).toBe("__cookie__");

      // Remove it
      removeTokens();

      // In jsdom, max-age=0 removes the cookie
      expect(getAccessToken()).toBeNull();
    });

    it("is idempotent - calling multiple times does not throw", () => {
      setTokens("a", "b");
      removeTokens();
      expect(() => removeTokens()).not.toThrow();
    });
  });

  // ---- getRefreshToken (deprecated) ----

  describe("getRefreshToken", () => {
    it("always returns null (deprecated)", () => {
      expect(getRefreshToken()).toBeNull();
    });

    it("returns null even after setTokens", () => {
      setTokens("access", "refresh");
      expect(getRefreshToken()).toBeNull();
    });
  });

  // ---- SSR safety ----

  describe("SSR environment handling", () => {
    it("getAccessToken handles exception gracefully without throwing", () => {
      // Save descriptor so we can restore before afterEach reads cookies
      const cookieDescriptor = Object.getOwnPropertyDescriptor(
        Document.prototype,
        "cookie"
      );

      // Override the getter to throw
      Object.defineProperty(document, "cookie", {
        get() {
          throw new Error("cookie access denied");
        },
        configurable: true,
      });

      let result: string | null | undefined;
      let threw = false;
      try {
        result = getAccessToken();
      } catch {
        threw = true;
      }

      // Restore the real cookie descriptor BEFORE afterEach runs clearAllCookies()
      if (cookieDescriptor) {
        Object.defineProperty(document, "cookie", cookieDescriptor);
      } else {
        Object.defineProperty(Document.prototype, "cookie", {
          configurable: true,
          enumerable: true,
          get() {
            return "";
          },
          set(_val: string) {},
        });
      }

      expect(threw).toBe(false);
      expect(result).toBeNull();
    });
  });
});
