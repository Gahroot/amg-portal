import * as React from "react";
import { screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders } from "@/test/mocks/wrapper";
import { TaskBoard } from "../task-board";

// ---- mock Next.js navigation ------------------------------------------------
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/tasks",
  useSearchParams: () => new URLSearchParams(),
}));

// ---- mock API layer ---------------------------------------------------------
// vi.hoisted so the data is available inside the hoisted vi.mock() factory.
const { mockTasks } = vi.hoisted(() => {
  const mockTasks = [
    {
      id: "task-1",
      milestone_id: "ms-1",
      title: "Draft proposal",
      description: "Write the initial draft",
      status: "todo" as const,
      priority: "high" as const,
      due_date: null,
      assigned_to: "user-1",
      assignee: { id: "user-1", name: "Alice Smith", email: "alice@example.com" },
      program: { id: "prog-1", title: "Alpha Program", status: "active" },
      milestone: { id: "ms-1", title: "Kickoff", program_id: "prog-1" },
      position: 0,
      depends_on: [],
      blocked_by: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "task-2",
      milestone_id: "ms-1",
      title: "Client review",
      description: null,
      status: "in_progress" as const,
      priority: "medium" as const,
      due_date: null,
      assigned_to: null,
      assignee: null,
      program: null,
      milestone: null,
      position: 0,
      depends_on: [],
      blocked_by: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "task-3",
      milestone_id: "ms-1",
      title: "Send final report",
      description: null,
      status: "done" as const,
      priority: "low" as const,
      due_date: null,
      assigned_to: null,
      assignee: null,
      program: null,
      milestone: null,
      position: 0,
      depends_on: [],
      blocked_by: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];
  return { mockTasks };
});

vi.mock("@/lib/api/tasks", () => ({
  getTasks: vi.fn().mockResolvedValue({ tasks: mockTasks, total: 3 }),
  getProgramsForFilter: vi.fn().mockResolvedValue([]),
  getAssigneesForFilter: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  updateTaskDependencies: vi.fn(),
  deleteTask: vi.fn(),
  reorderTask: vi.fn(),
  bulkUpdateTasks: vi.fn(),
}));

// ---- mock DnD Kit (drag behaviour is not meaningful to test in jsdom) -------
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DragOverlay: () => null,
    useSensor: vi.fn(() => ({})),
    useSensors: vi.fn((...args: unknown[]) => args),
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
    PointerSensor: class {},
    KeyboardSensor: class {},
    closestCorners: vi.fn(),
  };
});

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    ...actual,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
    SortableContext: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

// ---- sonner toast -----------------------------------------------------------
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// -----------------------------------------------------------------------------

describe("TaskBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders task status columns", async () => {
    renderWithProviders(<TaskBoard />);

    // Column headings from TASK_STATUSES
    expect(await screen.findByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("renders task cards in the correct columns", async () => {
    renderWithProviders(<TaskBoard />);

    expect(await screen.findByText("Draft proposal")).toBeInTheDocument();
    expect(screen.getByText("Client review")).toBeInTheDocument();
    expect(screen.getByText("Send final report")).toBeInTheDocument();
  });

  it("renders assignee name on task card", async () => {
    renderWithProviders(<TaskBoard />);
    expect(await screen.findByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders program label on task card", async () => {
    renderWithProviders(<TaskBoard />);
    expect(await screen.findByText("Alpha Program")).toBeInTheDocument();
  });

  it("shows Add Task button", async () => {
    renderWithProviders(<TaskBoard />);
    expect(
      await screen.findByRole("button", { name: /add task/i })
    ).toBeInTheDocument();
  });

  it("shows column task counts", async () => {
    renderWithProviders(<TaskBoard />);
    // Each status has one task — column header shows count badge
    const ones = await screen.findAllByText("1");
    // todo, in_progress, done each have 1 task
    expect(ones.length).toBeGreaterThanOrEqual(3);
    // Columns with 0 tasks
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(2); // blocked and cancelled
  });
});
