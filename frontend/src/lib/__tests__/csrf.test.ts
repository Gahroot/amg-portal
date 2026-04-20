import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  getCookie,
  getCsrfToken,
  isMutatingMethod,
} from "@/lib/csrf";

function clearAllCookies() {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name] = cookie.trim().split("=");
    if (name) {
      // Try both plain + Secure expiry: jsdom rejects a ``__Host-`` cookie
      // (including its expiry) unless ``Secure; Path=/`` is set, and rejects
      // a non-prefixed cookie written with ``Secure`` on an http:// URL.
      document.cookie = `${name}=; path=/; max-age=0`;
      document.cookie = `${name}=; path=/; max-age=0; Secure`;
    }
  }
}

describe("csrf helpers", () => {
  beforeEach(clearAllCookies);
  afterEach(clearAllCookies);

  describe("getCookie", () => {
    it("returns the value of a plain cookie", () => {
      document.cookie = "foo=bar";
      expect(getCookie("foo")).toBe("bar");
    });

    it("returns null when the cookie is absent", () => {
      expect(getCookie("missing")).toBeNull();
    });

    it("reads a cookie whose name contains the __Host- prefix", () => {
      // Real browsers (and jsdom) reject ``__Host-`` cookies that are not
      // ``Secure`` + ``Path=/``; production always sets those attributes,
      // so we set them here too. The reader itself treats the name as
      // opaque — this test proves the regex escapes the hyphen correctly.
      document.cookie = `${CSRF_COOKIE_NAME}=abc123; Secure; Path=/`;
      expect(getCookie(CSRF_COOKIE_NAME)).toBe("abc123");
    });

    it("URL-decodes the cookie value", () => {
      document.cookie = "token=hello%20world";
      expect(getCookie("token")).toBe("hello world");
    });

    it("strips surrounding double quotes (RFC 6265 quoted form)", () => {
      // jsdom may or may not preserve the quotes on set, so assert after
      // manually setting the raw cookie string.
      document.cookie = 'token="quoted-value"';
      const value = getCookie("token");
      // jsdom keeps the quotes; our reader strips them.
      expect(value).toBe("quoted-value");
    });

    it("picks the right cookie when multiple are set", () => {
      document.cookie = "first=1";
      document.cookie = "second=2";
      document.cookie = "third=3";
      expect(getCookie("second")).toBe("2");
    });

    it("does not match a prefix of another cookie", () => {
      document.cookie = "abcdef=wrong";
      expect(getCookie("abc")).toBeNull();
    });
  });

  describe("getCsrfToken", () => {
    it("reads the __Host-csrf cookie", () => {
      document.cookie = `${CSRF_COOKIE_NAME}=deadbeef; Secure; Path=/`;
      expect(getCsrfToken()).toBe("deadbeef");
    });

    it("returns null when the cookie is missing", () => {
      expect(getCsrfToken()).toBeNull();
    });
  });

  describe("isMutatingMethod", () => {
    it.each(["POST", "PUT", "PATCH", "DELETE"])(
      "treats %s as mutating",
      (method) => {
        expect(isMutatingMethod(method)).toBe(true);
      },
    );

    it.each(["GET", "HEAD", "OPTIONS"])(
      "treats %s as safe",
      (method) => {
        expect(isMutatingMethod(method)).toBe(false);
      },
    );

    it("is case-insensitive (axios may emit lowercase methods)", () => {
      expect(isMutatingMethod("post")).toBe(true);
      expect(isMutatingMethod("get")).toBe(false);
    });

    it("returns false for undefined (axios default = GET)", () => {
      expect(isMutatingMethod(undefined)).toBe(false);
    });
  });

  describe("CSRF_HEADER_NAME", () => {
    it("matches the backend-expected header", () => {
      expect(CSRF_HEADER_NAME).toBe("X-CSRF-Token");
    });
  });
});
