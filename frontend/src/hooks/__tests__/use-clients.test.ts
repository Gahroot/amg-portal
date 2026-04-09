import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useClientProfiles, useClientProfile } from "../use-clients";
import type { ClientProfileListResponse, ClientProfile } from "@/types/client";

// ---- mock API layer ---------------------------------------------------------
const mockListClientProfiles = vi.fn();
const mockGetClientProfile = vi.fn();

vi.mock("@/lib/api/clients", () => ({
  listClientProfiles: (...args: unknown[]) => mockListClientProfiles(...args),
  getClientProfile: (...args: unknown[]) => mockGetClientProfile(...args),
  createClientProfile: vi.fn(),
  updateClientProfile: vi.fn(),
  updateIntelligenceFile: vi.fn(),
  submitComplianceReview: vi.fn(),
  submitMDApproval: vi.fn(),
  provisionClient: vi.fn(),
  getMyPortfolio: vi.fn(),
  getPortalProfile: vi.fn(),
  getComplianceCertificate: vi.fn(),
  getSecurityBrief: vi.fn(),
  updateSecurityProfileLevel: vi.fn(),
}));

// ---- sonner -----------------------------------------------------------------
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// ---- helpers ----------------------------------------------------------------
const sampleProfile: ClientProfile = {
  id: "client-1",
  legal_name: "Acme Ltd",
  display_name: "Acme",
  entity_type: "corporation",
  jurisdiction: "US",
  tax_id: "12-3456789",
  primary_email: "cfo@acme.com",
  secondary_email: null,
  phone: null,
  address: null,
  communication_preference: null,
  sensitivities: null,
  special_instructions: null,
  compliance_status: "cleared",
  approval_status: "approved",
  compliance_notes: null,
  compliance_reviewed_by: null,
  compliance_reviewed_at: null,
  approved_by: null,
  approved_at: null,
  assigned_rm_id: "rm-1",
  security_profile_level: "standard",
  intelligence_file: null,
  user_id: null,
  welcome_email_sent: false,
  portal_access_enabled: true,
  birth_date: null,
  important_dates: null,
  birthday_reminders_enabled: false,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  created_by: "admin",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

// -----------------------------------------------------------------------------

describe("useClientProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns client data on success", async () => {
    const listResponse: ClientProfileListResponse = {
      profiles: [sampleProfile],
      total: 1,
    };
    mockListClientProfiles.mockResolvedValue(listResponse);

    const { result } = renderHook(() => useClientProfiles(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(listResponse);
    expect(result.current.data?.profiles).toHaveLength(1);
    expect(result.current.data?.profiles[0].legal_name).toBe("Acme Ltd");
  });

  it("reflects loading state before data resolves", async () => {
    // Never resolves — simulates in-flight request
    mockListClientProfiles.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useClientProfiles(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("reflects error state when the API rejects", async () => {
    mockListClientProfiles.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useClientProfiles(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Network error");
  });

  it("passes params to the API function", async () => {
    mockListClientProfiles.mockResolvedValue({ profiles: [], total: 0 });

    const params = { compliance_status: "cleared", limit: 10 };
    renderHook(() => useClientProfiles(params), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(mockListClientProfiles).toHaveBeenCalledWith(params)
    );
  });
});

describe("useClientProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a single client profile by id", async () => {
    mockGetClientProfile.mockResolvedValue(sampleProfile);

    const { result } = renderHook(() => useClientProfile("client-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(sampleProfile);
    expect(mockGetClientProfile).toHaveBeenCalledWith("client-1");
  });

  it("is disabled when id is empty", () => {
    const { result } = renderHook(() => useClientProfile(""), {
      wrapper: createWrapper(),
    });

    // `enabled: !!id` means query never fires — stays in idle/pending without fetching
    expect(result.current.isFetching).toBe(false);
    expect(mockGetClientProfile).not.toHaveBeenCalled();
  });
});
