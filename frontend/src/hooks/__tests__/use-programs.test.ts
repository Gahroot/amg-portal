import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  usePrograms,
  useProgram,
  useCreateProgram,
  useUpdateProgram,
} from "../use-programs";
import type {
  Program,
  ProgramListResponse,
  ProgramDetail,
} from "@/types/program";

// ---- mock API layer ---------------------------------------------------------
const mockListPrograms = vi.fn();
const mockGetProgram = vi.fn();
const mockCreateProgram = vi.fn();
const mockUpdateProgram = vi.fn();

vi.mock("@/lib/api/programs", () => ({
  listPrograms: (...args: unknown[]) => mockListPrograms(...args),
  getProgram: (...args: unknown[]) => mockGetProgram(...args),
  createProgram: (...args: unknown[]) => mockCreateProgram(...args),
  updateProgram: (...args: unknown[]) => mockUpdateProgram(...args),
  getProgramSummary: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  updateTask: vi.fn(),
}));

// ---- sonner -----------------------------------------------------------------
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// ---- helpers ----------------------------------------------------------------
const sampleProgram: Program = {
  id: "program-1",
  client_id: "client-1",
  client_name: "Acme Ltd",
  title: "Digital Transformation",
  objectives: "Modernize infrastructure",
  scope: "Cloud migration",
  budget_envelope: 100000,
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  status: "active",
  rag_status: "green",
  milestone_count: 5,
  completed_milestone_count: 2,
  created_by: "admin",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const sampleProgramDetail: ProgramDetail = {
  ...sampleProgram,
  emergency_reason: null,
  retrospective_due_at: null,
  milestones: [],
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

describe("usePrograms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns programs data on success", async () => {
    const listResponse: ProgramListResponse = {
      programs: [sampleProgram],
      total: 1,
    };
    mockListPrograms.mockResolvedValue(listResponse);

    const { result } = renderHook(() => usePrograms(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(listResponse);
    expect(result.current.data?.programs).toHaveLength(1);
    expect(result.current.data?.programs[0].title).toBe("Digital Transformation");
  });

  it("reflects loading state before data resolves", async () => {
    // Never resolves — simulates in-flight request
    mockListPrograms.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePrograms(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("reflects error state when the API rejects", async () => {
    mockListPrograms.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => usePrograms(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Network error");
  });

  it("passes params to the API function", async () => {
    mockListPrograms.mockResolvedValue({ programs: [], total: 0 });

    const params = { status: "active" as const, limit: 10 };
    renderHook(() => usePrograms(params), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(mockListPrograms).toHaveBeenCalledWith(params)
    );
  });
});

describe("useProgram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a single program by id", async () => {
    mockGetProgram.mockResolvedValue(sampleProgramDetail);

    const { result } = renderHook(() => useProgram("program-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(sampleProgramDetail);
    expect(mockGetProgram).toHaveBeenCalledWith("program-1");
  });

  it("is disabled when id is empty", () => {
    const { result } = renderHook(() => useProgram(""), {
      wrapper: createWrapper(),
    });

    // `enabled: !!id` means query never fires — stays in idle/pending without fetching
    expect(result.current.isFetching).toBe(false);
    expect(mockGetProgram).not.toHaveBeenCalled();
  });
});

describe("useCreateProgram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a program successfully", async () => {
    const newProgramData = {
      client_id: "client-1",
      title: "New Program",
    };
    const createdProgram = { ...sampleProgram, ...newProgramData };
    mockCreateProgram.mockResolvedValue(createdProgram);

    const { result } = renderHook(() => useCreateProgram(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(newProgramData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCreateProgram).toHaveBeenCalledWith(newProgramData);
    expect(result.current.data).toEqual(createdProgram);
  });

  it("shows toast error on failure", async () => {
    const { toast } = await import("sonner");
    mockCreateProgram.mockRejectedValue(new Error("Creation failed"));

    const { result } = renderHook(() => useCreateProgram(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ client_id: "client-1", title: "Test" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Creation failed");
  });

  it("shows fallback toast error when error has no message", async () => {
    const { toast } = await import("sonner");
    mockCreateProgram.mockRejectedValue(new Error());

    const { result } = renderHook(() => useCreateProgram(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ client_id: "client-1", title: "Test" });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Failed to create program");
  });
});

describe("useUpdateProgram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a program successfully and invalidates cache", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0, gcTime: 0 },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = function Wrapper({ children }: { children: ReactNode }) {
      return createElement(
        QueryClientProvider,
        { client: queryClient },
        children
      );
    };

    const updateData = { title: "Updated Title" };
    const updatedProgram = { ...sampleProgram, ...updateData };
    mockUpdateProgram.mockResolvedValue(updatedProgram);

    const { result } = renderHook(() => useUpdateProgram(), {
      wrapper,
    });

    result.current.mutate({ id: "program-1", data: updateData });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockUpdateProgram).toHaveBeenCalledWith("program-1", updateData);
    expect(result.current.data).toEqual(updatedProgram);

    // Verify cache invalidation
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["programs"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["programs", "detail", "program-1"] });
  });

  it("shows toast error on failure", async () => {
    const { toast } = await import("sonner");
    mockUpdateProgram.mockRejectedValue(new Error("Update failed"));

    const { result } = renderHook(() => useUpdateProgram(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "program-1", data: { title: "Test" } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Update failed");
  });

  it("shows fallback toast error when error has no message", async () => {
    const { toast } = await import("sonner");
    mockUpdateProgram.mockRejectedValue(new Error());

    const { result } = renderHook(() => useUpdateProgram(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: "program-1", data: { title: "Test" } });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).toHaveBeenCalledWith("Failed to update program");
  });
});
