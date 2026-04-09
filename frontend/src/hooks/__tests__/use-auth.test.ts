import { renderHook, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth, MFARequiredError, MFASetupRequiredError } from "@/providers/auth-provider";
import type { User, LoginCredentials, AuthResponse } from "@/types/user";

// ---- mock API layer ---------------------------------------------------------
const mockLoginApi = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  login: (...args: unknown[]) => mockLoginApi(...args),
  getCurrentUser: () => mockGetCurrentUser(),
}));

// ---- mock token storage -----------------------------------------------------
const mockGetAccessToken = vi.fn();
const mockSetTokens = vi.fn();
const mockRemoveTokens = vi.fn();

vi.mock("@/lib/token-storage", () => ({
  getAccessToken: () => mockGetAccessToken(),
  setTokens: (access: string, refresh: string) => mockSetTokens(access, refresh),
  removeTokens: () => mockRemoveTokens(),
}));

// ---- mock next/navigation ---------------------------------------------------
const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
  usePathname: () => "/test-path",
}));

// ---- test helpers -----------------------------------------------------------
const sampleUser: User = {
  id: "user-1",
  email: "test@example.com",
  full_name: "Test User",
  phone_number: null,
  role: "relationship_manager",
  status: "active",
  mfa_enabled: false,
  created_at: "2025-01-01T00:00:00Z",
};

const clientUser: User = {
  ...sampleUser,
  id: "client-1",
  role: "client",
};

const partnerUser: User = {
  ...sampleUser,
  id: "partner-1",
  role: "partner",
};

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(AuthProvider, null, children);
  };
}

// -----------------------------------------------------------------------------

describe("useAuth hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with isLoading=true and fetches user on mount", async () => {
      mockGetAccessToken.mockReturnValue("valid-token");
      mockGetCurrentUser.mockResolvedValue(sampleUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);

      // Wait for fetch to complete
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toEqual(sampleUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    });

    it("sets isLoading to false and user to null when no token exists", async () => {
      mockGetAccessToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // When no token exists, isLoading becomes false synchronously after the effect runs
      // Wait for the effect to complete
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      // getCurrentUser should not be called when no token
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it("clears tokens and sets user to null when fetch fails", async () => {
      mockGetAccessToken.mockReturnValue("invalid-token");
      mockGetCurrentUser.mockRejectedValue(new Error("Unauthorized"));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockRemoveTokens).toHaveBeenCalled();
    });
  });

  describe("login function", () => {
    const credentials: LoginCredentials = {
      email: "test@example.com",
      password: "password123",
    };

    const successResponse: AuthResponse = {
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
      mfa_required: false,
      mfa_setup_required: false,
      mfa_setup_token: null,
    };

    it("sets tokens and redirects to /portal/dashboard for client role", async () => {
      mockLoginApi.mockResolvedValue(successResponse);
      mockGetCurrentUser.mockResolvedValue(clientUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(mockLoginApi).toHaveBeenCalledWith(credentials);
      expect(mockSetTokens).toHaveBeenCalledWith("access-token", "refresh-token");
      expect(mockGetCurrentUser).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith("/portal/dashboard");
    });

    it("sets tokens and redirects to /partner for partner role", async () => {
      mockLoginApi.mockResolvedValue(successResponse);
      mockGetCurrentUser.mockResolvedValue(partnerUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(mockSetTokens).toHaveBeenCalledWith("access-token", "refresh-token");
      expect(mockReplace).toHaveBeenCalledWith("/partner");
    });

    it("sets tokens and redirects to / for other roles", async () => {
      mockLoginApi.mockResolvedValue(successResponse);
      mockGetCurrentUser.mockResolvedValue(sampleUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login(credentials);
      });

      expect(mockSetTokens).toHaveBeenCalledWith("access-token", "refresh-token");
      expect(mockReplace).toHaveBeenCalledWith("/");
    });

    it("throws MFARequiredError when mfa_required is true", async () => {
      const mfaRequiredResponse: AuthResponse = {
        ...successResponse,
        mfa_required: true,
      };
      mockLoginApi.mockResolvedValue(mfaRequiredResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Clear any redirects from initial mount (auth provider redirects to /login on non-public paths)
      mockReplace.mockClear();

      await act(async () => {
        await expect(result.current.login(credentials)).rejects.toThrow(MFARequiredError);
      });

      expect(mockSetTokens).not.toHaveBeenCalled();
      // No additional redirects from login function itself
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("throws MFASetupRequiredError when mfa_setup_required is true (grace-period path)", async () => {
      const mfaSetupResponse: AuthResponse = {
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "bearer",
        mfa_required: false,
        mfa_setup_required: true,
        mfa_setup_token: null,
      };
      mockLoginApi.mockResolvedValue(mfaSetupResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await expect(result.current.login(credentials)).rejects.toThrow(MFASetupRequiredError);
      });

      expect(mockSetTokens).toHaveBeenCalledWith("access-token", "refresh-token");
    });

    it("throws MFASetupRequiredError without storing tokens in hard-enforcement mfa_setup_required flow", async () => {
      const mfaSetupResponse: AuthResponse = {
        access_token: "",
        refresh_token: "",
        token_type: "bearer",
        mfa_required: false,
        mfa_setup_required: true,
        mfa_setup_token: null,
      };
      mockLoginApi.mockResolvedValue(mfaSetupResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await expect(result.current.login(credentials)).rejects.toThrow(MFASetupRequiredError);
      });

      // setTokens should not be called with empty tokens
      expect(mockSetTokens).not.toHaveBeenCalled();
    });
  });

  describe("logout function", () => {
    it("removes tokens, sets user to null, and redirects to /login", async () => {
      mockGetAccessToken.mockReturnValue("valid-token");
      mockGetCurrentUser.mockResolvedValue(sampleUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        result.current.logout();
      });

      expect(mockRemoveTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  describe("refreshUser function", () => {
    it("refetches user data and updates state", async () => {
      mockGetAccessToken.mockReturnValue("valid-token");
      mockGetCurrentUser.mockResolvedValueOnce(sampleUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).toEqual(sampleUser);
      });

      // Update the mock to return updated user
      const updatedUser: User = {
        ...sampleUser,
        full_name: "Updated Name",
      };
      mockGetCurrentUser.mockResolvedValueOnce(updatedUser);

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toEqual(updatedUser);
    });

    it("does nothing when no token exists", async () => {
      mockGetAccessToken.mockReturnValue(null);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockGetCurrentUser.mockClear();

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });

    it("clears tokens and user when refresh fails", async () => {
      mockGetAccessToken.mockReturnValue("valid-token");
      mockGetCurrentUser.mockResolvedValueOnce(sampleUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).toEqual(sampleUser);
      });

      mockGetCurrentUser.mockRejectedValueOnce(new Error("Unauthorized"));

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(mockRemoveTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });
  });

  describe("auth:logout event listener", () => {
    it("clears tokens and user state when auth:logout event is dispatched", async () => {
      mockGetAccessToken.mockReturnValue("valid-token");
      mockGetCurrentUser.mockResolvedValue(sampleUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Dispatch the auth:logout event
      act(() => {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      });

      await waitFor(() => {
        expect(mockRemoveTokens).toHaveBeenCalled();
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });

  describe("error handling", () => {
    it("throws error when useAuth is used outside AuthProvider", () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow("useAuth must be used within an AuthProvider");

      spy.mockRestore();
    });
  });

  describe("MFARequiredError", () => {
    it("has correct properties", () => {
      const error = new MFARequiredError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("MFARequiredError");
      expect(error.message).toBe("MFA code required");
      expect(error.mfaRequired).toBe(true);
    });
  });

  describe("MFASetupRequiredError", () => {
    it("has correct properties", () => {
      const error = new MFASetupRequiredError();
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("MFASetupRequiredError");
      expect(error.message).toBe("MFA setup required");
      expect(error.mfaSetupRequired).toBe(true);
    });
  });
});
