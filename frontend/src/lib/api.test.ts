import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock localStorage before importing the module
const mockStorage: Record<string, string> = {};

vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
});

// Must import after mocking
import { api, logout } from "./api";

describe("api client", () => {
  it("has correct base URL", () => {
    // Default is http://localhost:8000
    expect(api.defaults.baseURL).toBe("http://localhost:8000");
  });

  it("has JSON content type", () => {
    expect(api.defaults.headers["Content-Type"]).toBe("application/json");
  });

  it("has withCredentials enabled", () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("has a 30s timeout", () => {
    expect(api.defaults.timeout).toBe(30000);
  });
});

describe("logout", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  it("clears tokens from localStorage", () => {
    // Set some mock location
    const originalHref = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      value: { href: "/" },
      writable: true,
    });

    mockStorage["access_token"] = "some-token";
    mockStorage["refresh_token"] = "some-refresh";

    logout();

    expect(localStorage.removeItem).toHaveBeenCalledWith("access_token");
    expect(localStorage.removeItem).toHaveBeenCalledWith("refresh_token");
    expect(window.location.href).toBe("/login");

    // Restore
    if (originalHref) {
      Object.defineProperty(window, "location", originalHref);
    }
  });
});
