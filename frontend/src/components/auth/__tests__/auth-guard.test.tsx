import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useAuth } from "@/providers/auth-provider";
import { AuthGuard } from "../auth-guard";
import type { User } from "@/types/user";

// ---- mocks ------------------------------------------------------------------

const mockReplace = vi.fn();

vi.mock("@/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

const mockUseAuth = vi.mocked(useAuth);

// Sample user for authenticated tests
const sampleUser: User = {
  id: "user-1",
  email: "test@example.com",
  full_name: "Test User",
  role: "relationship_manager",
  status: "active",
  mfa_enabled: false,
  created_at: "2025-01-01T00:00:00Z",
};

// -----------------------------------------------------------------------------

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading when isLoading is true", () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(<AuthGuard>Protected Content</AuthGuard>);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows loading state when not authenticated (during redirect)", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(<AuthGuard>Protected Content</AuthGuard>);

    // Should show loading skeleton during redirect
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to /login when not loading and not authenticated", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(<AuthGuard>Protected Content</AuthGuard>);

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: sampleUser,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    render(<AuthGuard>Protected Content</AuthGuard>);

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
