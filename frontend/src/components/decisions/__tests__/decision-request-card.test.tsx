import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { DecisionRequestCard } from "../decision-request-card";
import type { DecisionRequest } from "@/types/communication";

// ---- helpers ----------------------------------------------------------------
const futureDate = new Date();
futureDate.setFullYear(futureDate.getFullYear() + 1);
const futureDateStr = futureDate.toISOString().split("T")[0]; // YYYY-MM-DD

const pastDate = new Date();
pastDate.setFullYear(pastDate.getFullYear() - 1);
const pastDateStr = pastDate.toISOString().split("T")[0];

const baseDecision: DecisionRequest = {
  id: "dec-1",
  client_id: "client-1",
  program_id: "prog-1",
  title: "Choose investment strategy",
  prompt: "Which strategy do you prefer?",
  response_type: "choice",
  options: [
    { id: "opt-1", label: "Conservative" },
    { id: "opt-2", label: "Balanced" },
    { id: "opt-3", label: "Aggressive" },
  ],
  status: "pending",
  deadline_date: futureDateStr,
  deadline_time: undefined,
  consequence_text: "Default will be applied if no response.",
  created_by: "rm-1",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

// -----------------------------------------------------------------------------

describe("DecisionRequestCard", () => {
  it("renders the decision title and prompt", () => {
    render(<DecisionRequestCard decision={baseDecision} />);

    expect(screen.getByText("Choose investment strategy")).toBeInTheDocument();
    expect(screen.getByText("Which strategy do you prefer?")).toBeInTheDocument();
  });

  it("renders response type badge", () => {
    render(<DecisionRequestCard decision={baseDecision} />);
    // response_type "choice" rendered as "choice" (underscores replaced)
    expect(screen.getByText("choice")).toBeInTheDocument();
  });

  it("renders all option labels", () => {
    render(<DecisionRequestCard decision={baseDecision} />);
    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Aggressive")).toBeInTheDocument();
  });

  it("shows +N more badge when there are more than 3 options", () => {
    const decision: DecisionRequest = {
      ...baseDecision,
      options: [
        { id: "o1", label: "Option A" },
        { id: "o2", label: "Option B" },
        { id: "o3", label: "Option C" },
        { id: "o4", label: "Option D" },
        { id: "o5", label: "Option E" },
      ],
    };
    render(<DecisionRequestCard decision={decision} />);
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("shows status badge — Pending", () => {
    render(<DecisionRequestCard decision={baseDecision} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows status badge — Responded", () => {
    render(<DecisionRequestCard decision={{ ...baseDecision, status: "responded" }} />);
    expect(screen.getByText("Responded")).toBeInTheDocument();
  });

  it("shows future deadline with Deadline label (not overdue)", () => {
    render(<DecisionRequestCard decision={baseDecision} />);
    expect(screen.getByText(/deadline:/i)).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
  });

  it("shows overdue styling when deadline has passed and status is pending", () => {
    const overdueDecision: DecisionRequest = {
      ...baseDecision,
      deadline_date: pastDateStr,
    };
    render(<DecisionRequestCard decision={overdueDecision} />);
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it("shows Respond button when status is pending", () => {
    render(<DecisionRequestCard decision={baseDecision} />);
    expect(screen.getByRole("button", { name: /respond/i })).toBeInTheDocument();
  });

  it("hides Respond button when status is responded", () => {
    render(
      <DecisionRequestCard decision={{ ...baseDecision, status: "responded" }} />
    );
    expect(
      screen.queryByRole("button", { name: /respond/i })
    ).not.toBeInTheDocument();
  });

  it("calls onResponse when Respond is clicked", async () => {
    const user = userEvent.setup();
    const onResponse = vi.fn();
    render(<DecisionRequestCard decision={baseDecision} onResponse={onResponse} />);

    await user.click(screen.getByRole("button", { name: /respond/i }));
    expect(onResponse).toHaveBeenCalledTimes(1);
  });

  it("calls onViewDetails when View Details is clicked", async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    render(
      <DecisionRequestCard decision={baseDecision} onViewDetails={onViewDetails} />
    );

    await user.click(screen.getByRole("button", { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it("renders without optional fields (no options, no deadline)", () => {
    const minimal: DecisionRequest = {
      id: "dec-2",
      client_id: "client-1",
      title: "Simple yes/no",
      prompt: "Do you agree?",
      response_type: "yes_no",
      status: "pending",
      created_by: "rm-1",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
    render(<DecisionRequestCard decision={minimal} />);
    expect(screen.getByText("Simple yes/no")).toBeInTheDocument();
    expect(screen.queryByText(/deadline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/options/i)).not.toBeInTheDocument();
  });
});
