import { describe, it, expect } from "vitest";
import {
  programCreateSchema,
  milestoneSchema,
  taskCreateSchema,
} from "./program";

describe("milestoneSchema", () => {
  it("accepts valid milestone", () => {
    const result = milestoneSchema.safeParse({
      title: "Phase 1",
      description: "Initial phase",
      due_date: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("requires title", () => {
    const result = milestoneSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be omitted", () => {
    const result = milestoneSchema.safeParse({ title: "Minimal" });
    expect(result.success).toBe(true);
  });
});

describe("programCreateSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid program", () => {
    const result = programCreateSchema.safeParse({
      client_id: validUUID,
      title: "Wealth Management Program",
      objectives: "Maximize returns",
      budget_envelope: 1000000,
    });
    expect(result.success).toBe(true);
  });

  it("requires client_id", () => {
    const result = programCreateSchema.safeParse({
      title: "No Client",
    });
    expect(result.success).toBe(false);
  });

  it("requires title", () => {
    const result = programCreateSchema.safeParse({
      client_id: validUUID,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for client_id", () => {
    const result = programCreateSchema.safeParse({
      client_id: "not-a-uuid",
      title: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("accepts program with milestones", () => {
    const result = programCreateSchema.safeParse({
      client_id: validUUID,
      title: "With Milestones",
      milestones: [
        { title: "M1", due_date: "2026-03-01" },
        { title: "M2" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects milestones with empty title", () => {
    const result = programCreateSchema.safeParse({
      client_id: validUUID,
      title: "With Bad Milestone",
      milestones: [{ title: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("allows optional fields", () => {
    const result = programCreateSchema.safeParse({
      client_id: validUUID,
      title: "Minimal Program",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.objectives).toBeUndefined();
      expect(result.data.budget_envelope).toBeUndefined();
    }
  });
});

describe("taskCreateSchema", () => {
  it("accepts valid task", () => {
    const result = taskCreateSchema.safeParse({
      title: "Review documents",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("requires title", () => {
    const result = taskCreateSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("validates priority enum", () => {
    const result = taskCreateSchema.safeParse({
      title: "Test",
      priority: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid priorities", () => {
    for (const priority of ["low", "medium", "high", "urgent"]) {
      const result = taskCreateSchema.safeParse({
        title: "Test",
        priority,
      });
      expect(result.success).toBe(true);
    }
  });

  it("allows all fields optional except title", () => {
    const result = taskCreateSchema.safeParse({ title: "Just a title" });
    expect(result.success).toBe(true);
  });
});
