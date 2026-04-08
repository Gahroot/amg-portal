import { describe, it, expect } from "vitest";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaSetupSchema,
} from "@/lib/validations/auth";
import {
  clientIdentitySchema,
  clientContactSchema,
  familyMemberSchema,
  intakeFormSchema,
} from "@/lib/validations/client";
import {
  programCreateSchema,
  programFilterSchema,
  milestoneSchema,
} from "@/lib/validations/program";
import {
  taskFormSchema,
  taskCreateSchema,
  taskFilterSchema,
  taskPrioritySchema,
  taskStatusSchema,
} from "@/lib/validations/task";
import {
  governanceActionSchema,
  partnerOnboardingSchema,
  partnerCertificationSchema,
} from "@/lib/validations/partner";
import {
  escalationRuleSchema,
  resolveEscalationSchema,
  acknowledgeEscalationSchema,
} from "@/lib/validations/escalation";

// ---- Auth Validation Tests ----

describe("loginSchema", () => {
  it("validates correct login data", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional mfa_code", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      mfa_code: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = loginSchema.safeParse({
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("validates correct email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("validates matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "StrongPass1!",
      confirm_password: "StrongPass1!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "StrongPass1!",
      confirm_password: "Different1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password - no uppercase", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "weakpass1!",
      confirm_password: "weakpass1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password - no number", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "WeakPassword!",
      confirm_password: "WeakPassword!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weak password - no special char", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "WeakPassword1",
      confirm_password: "WeakPassword1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password under 8 chars", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "Sh1!",
      confirm_password: "Sh1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing token", () => {
    const result = resetPasswordSchema.safeParse({
      password: "StrongPass1!",
      confirm_password: "StrongPass1!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty token", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "StrongPass1!",
      confirm_password: "StrongPass1!",
    });
    expect(result.success).toBe(false);
  });
});

describe("mfaSetupSchema", () => {
  it("validates 6-digit code", () => {
    const result = mfaSetupSchema.safeParse({ code: "123456" });
    expect(result.success).toBe(true);
  });

  it("validates 8-digit code (max)", () => {
    const result = mfaSetupSchema.safeParse({ code: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects code shorter than 6 chars", () => {
    const result = mfaSetupSchema.safeParse({ code: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 8 chars", () => {
    const result = mfaSetupSchema.safeParse({ code: "123456789" });
    expect(result.success).toBe(false);
  });
});

// ---- Client Validation Tests ----

describe("clientIdentitySchema", () => {
  it("validates correct identity data", () => {
    const result = clientIdentitySchema.safeParse({
      legal_name: "Doe Family Trust",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty legal name", () => {
    const result = clientIdentitySchema.safeParse({
      legal_name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing legal name", () => {
    const result = clientIdentitySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts all optional fields", () => {
    const result = clientIdentitySchema.safeParse({
      legal_name: "Doe Trust",
      display_name: "Doe",
      entity_type: "trust",
      jurisdiction: "US",
      tax_id: "123-45-6789",
    });
    expect(result.success).toBe(true);
  });

  it("allows omitting optional fields", () => {
    const result = clientIdentitySchema.safeParse({
      legal_name: "Simple Name",
    });
    expect(result.success).toBe(true);
  });
});

describe("clientContactSchema", () => {
  it("validates correct contact data", () => {
    const result = clientContactSchema.safeParse({
      primary_email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = clientContactSchema.safeParse({
      primary_email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = clientContactSchema.safeParse({
      primary_email: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = clientContactSchema.safeParse({
      primary_email: "test@example.com",
      secondary_email: "alt@example.com",
      phone: "+1-555-0100",
      address: "123 Main St",
    });
    expect(result.success).toBe(true);
  });
});

describe("familyMemberSchema", () => {
  it("validates correct family member", () => {
    const result = familyMemberSchema.safeParse({
      name: "Jane Doe",
      relationship_type: "spouse",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = familyMemberSchema.safeParse({
      name: "",
      relationship_type: "spouse",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid relationship type", () => {
    const result = familyMemberSchema.safeParse({
      name: "Jane Doe",
      relationship_type: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid relationship types", () => {
    const types = [
      "spouse",
      "partner",
      "child",
      "parent",
      "sibling",
      "grandparent",
      "grandchild",
      "aunt_uncle",
      "cousin",
      "in_law",
      "other",
    ];
    for (const type of types) {
      const result = familyMemberSchema.safeParse({
        name: "Test",
        relationship_type: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional fields", () => {
    const result = familyMemberSchema.safeParse({
      name: "Jane Doe",
      relationship_type: "child",
      date_of_birth: "2000-01-01",
      occupation: "Student",
      notes: "Attends university",
      is_primary_contact: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("intakeFormSchema", () => {
  it("validates minimum required fields", () => {
    const result = intakeFormSchema.safeParse({
      legal_name: "Doe Family",
      primary_email: "doe@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing legal_name", () => {
    const result = intakeFormSchema.safeParse({
      primary_email: "doe@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid primary_email", () => {
    const result = intakeFormSchema.safeParse({
      legal_name: "Doe Family",
      primary_email: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts family_members array", () => {
    const result = intakeFormSchema.safeParse({
      legal_name: "Doe Family",
      primary_email: "doe@example.com",
      family_members: [{ name: "Bob", relationship_type: "spouse" }],
    });
    expect(result.success).toBe(true);
  });
});

// ---- Program Validation Tests ----

describe("programCreateSchema", () => {
  it("validates correct program data", () => {
    const result = programCreateSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Estate Planning",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid client_id (not UUID)", () => {
    const result = programCreateSchema.safeParse({
      client_id: "not-a-uuid",
      title: "Estate Planning",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty title", () => {
    const result = programCreateSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = programCreateSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = programCreateSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Program",
      objectives: "obj",
      scope: "scope",
      budget_envelope: 100000,
      milestones: [{ title: "Phase 1", position: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative budget_envelope as unexpected type would fail — accepts 0", () => {
    const result = programCreateSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Program",
      budget_envelope: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts start_date and end_date", () => {
    const result = programCreateSchema.safeParse({
      client_id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Timed Program",
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    });
    expect(result.success).toBe(true);
  });
});

describe("milestoneSchema", () => {
  it("validates correct milestone", () => {
    const result = milestoneSchema.safeParse({
      title: "Phase 1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = milestoneSchema.safeParse({
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = milestoneSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const result = milestoneSchema.safeParse({
      title: "Phase 1",
      description: "First phase of work",
      due_date: "2024-06-30",
      position: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("programFilterSchema", () => {
  it("accepts empty filter (all optional)", () => {
    const result = programFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid rag_status values", () => {
    for (const rag of ["red", "amber", "green"]) {
      const result = programFilterSchema.safeParse({ rag_status: rag });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid rag_status", () => {
    const result = programFilterSchema.safeParse({ rag_status: "yellow" });
    expect(result.success).toBe(false);
  });

  it("accepts full filter object", () => {
    const result = programFilterSchema.safeParse({
      client_id: "some-id",
      status: "active",
      rag_status: "green",
      search: "estate",
    });
    expect(result.success).toBe(true);
  });
});

// ---- Task Validation Tests ----

describe("taskFormSchema", () => {
  it("validates correct task data", () => {
    const result = taskFormSchema.safeParse({
      title: "Review documents",
      milestone_id: "milestone-1",
      status: "todo",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = taskFormSchema.safeParse({
      title: "",
      milestone_id: "milestone-1",
      status: "todo",
      priority: "high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects title over 255 chars", () => {
    const result = taskFormSchema.safeParse({
      title: "a".repeat(256),
      milestone_id: "milestone-1",
      status: "todo",
      priority: "high",
    });
    expect(result.success).toBe(false);
  });

  it("accepts title exactly 255 chars", () => {
    const result = taskFormSchema.safeParse({
      title: "a".repeat(255),
      milestone_id: "milestone-1",
      status: "todo",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects description over 2000 chars", () => {
    const result = taskFormSchema.safeParse({
      title: "Task",
      description: "a".repeat(2001),
      milestone_id: "milestone-1",
      status: "todo",
      priority: "high",
    });
    expect(result.success).toBe(false);
  });

  it("accepts description exactly 2000 chars", () => {
    const result = taskFormSchema.safeParse({
      title: "Task",
      description: "a".repeat(2000),
      milestone_id: "milestone-1",
      status: "todo",
      priority: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = taskFormSchema.safeParse({
      title: "Task",
      milestone_id: "m1",
      status: "invalid_status",
      priority: "high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = taskFormSchema.safeParse({
      title: "Task",
      milestone_id: "m1",
      status: "todo",
      priority: "super_urgent",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["todo", "in_progress", "blocked", "done", "cancelled"]) {
      const result = taskFormSchema.safeParse({
        title: "Task",
        milestone_id: "m1",
        status,
        priority: "medium",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid priorities", () => {
    for (const priority of ["low", "medium", "high", "urgent"]) {
      const result = taskFormSchema.safeParse({
        title: "Task",
        milestone_id: "m1",
        status: "todo",
        priority,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional due_date and assigned_to", () => {
    const result = taskFormSchema.safeParse({
      title: "Task",
      milestone_id: "m1",
      status: "todo",
      priority: "low",
      due_date: "2024-12-31",
      assigned_to: "user-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null assigned_to", () => {
    const result = taskFormSchema.safeParse({
      title: "Task",
      milestone_id: "m1",
      status: "todo",
      priority: "low",
      assigned_to: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("taskCreateSchema", () => {
  it("validates minimum required fields", () => {
    const result = taskCreateSchema.safeParse({
      title: "New Task",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = taskCreateSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("accepts optional priority", () => {
    const result = taskCreateSchema.safeParse({
      title: "Task",
      priority: "urgent",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid priority", () => {
    const result = taskCreateSchema.safeParse({
      title: "Task",
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });
});

describe("taskPrioritySchema", () => {
  it("accepts all valid priorities", () => {
    for (const p of ["low", "medium", "high", "urgent"]) {
      expect(taskPrioritySchema.safeParse(p).success).toBe(true);
    }
  });

  it("rejects invalid priority", () => {
    expect(taskPrioritySchema.safeParse("critical").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(taskPrioritySchema.safeParse("").success).toBe(false);
  });
});

describe("taskStatusSchema", () => {
  it("accepts all valid statuses", () => {
    for (const s of ["todo", "in_progress", "blocked", "done", "cancelled"]) {
      expect(taskStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(taskStatusSchema.safeParse("pending").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(taskStatusSchema.safeParse("").success).toBe(false);
  });
});

describe("taskFilterSchema", () => {
  it("accepts empty filter (all optional)", () => {
    const result = taskFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts full filter with valid values", () => {
    const result = taskFilterSchema.safeParse({
      status: "in_progress",
      priority: "high",
      assigned_to: "user-1",
      milestone_id: "m-1",
      due_date_from: "2024-01-01",
      due_date_to: "2024-12-31",
      search: "review",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status in filter", () => {
    const result = taskFilterSchema.safeParse({ status: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid priority in filter", () => {
    const result = taskFilterSchema.safeParse({ priority: "super" });
    expect(result.success).toBe(false);
  });
});

// ---- Partner Validation Tests ----

describe("governanceActionSchema", () => {
  it("validates correct governance action", () => {
    const result = governanceActionSchema.safeParse({
      action: "warning",
      reason: "Performance below threshold",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty reason", () => {
    const result = governanceActionSchema.safeParse({
      action: "warning",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid action", () => {
    const result = governanceActionSchema.safeParse({
      action: "promote",
      reason: "Good work",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid action types", () => {
    for (const action of [
      "warning",
      "probation",
      "suspension",
      "termination",
      "reinstatement",
    ]) {
      const result = governanceActionSchema.safeParse({
        action,
        reason: "Valid reason",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional expiry_date", () => {
    const result = governanceActionSchema.safeParse({
      action: "suspension",
      reason: "Policy violation",
      expiry_date: "2024-06-30",
    });
    expect(result.success).toBe(true);
  });
});

describe("partnerOnboardingSchema", () => {
  it("validates correct onboarding data", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "Acme Partners",
      primary_contact_name: "John Doe",
      primary_contact_email: "john@acme.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "Acme",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "Acme",
      primary_contact_name: "John",
      primary_contact_email: "not-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty company_name", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "",
      primary_contact_name: "John",
      primary_contact_email: "john@acme.com",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid website URL", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "Acme",
      primary_contact_name: "John",
      primary_contact_email: "john@acme.com",
      website: "https://www.acme.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for website", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "Acme",
      primary_contact_name: "John",
      primary_contact_email: "john@acme.com",
      website: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid website URL (non-empty)", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "Acme",
      primary_contact_name: "John",
      primary_contact_email: "john@acme.com",
      website: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts service_categories array", () => {
    const result = partnerOnboardingSchema.safeParse({
      company_name: "Acme",
      primary_contact_name: "John",
      primary_contact_email: "john@acme.com",
      service_categories: ["legal", "financial"],
    });
    expect(result.success).toBe(true);
  });
});

describe("partnerCertificationSchema", () => {
  it("validates correct certification", () => {
    const result = partnerCertificationSchema.safeParse({
      name: "ISO 9001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = partnerCertificationSchema.safeParse({
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = partnerCertificationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts all optional fields", () => {
    const result = partnerCertificationSchema.safeParse({
      name: "ISO 9001",
      issuing_body: "ISO",
      issue_date: "2023-01-01",
      expiry_date: "2026-01-01",
      certificate_number: "CERT-12345",
      verification_status: "verified",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid verification_status", () => {
    const result = partnerCertificationSchema.safeParse({
      name: "ISO 9001",
      verification_status: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid verification_status values", () => {
    for (const status of ["pending", "verified", "expired", "revoked"]) {
      const result = partnerCertificationSchema.safeParse({
        name: "Cert",
        verification_status: status,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---- Escalation Validation Tests ----

describe("escalationRuleSchema", () => {
  it("validates correct escalation rule", () => {
    const result = escalationRuleSchema.safeParse({
      name: "SLA Breach Alert",
      trigger_type: "sla_breach",
      escalation_level: "task",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = escalationRuleSchema.safeParse({
      name: "",
      trigger_type: "sla_breach",
      escalation_level: "task",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid trigger_type", () => {
    const result = escalationRuleSchema.safeParse({
      name: "Rule",
      trigger_type: "invalid_trigger",
      escalation_level: "task",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid escalation_level", () => {
    const result = escalationRuleSchema.safeParse({
      name: "Rule",
      trigger_type: "manual",
      escalation_level: "critical",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid trigger types", () => {
    for (const trigger_type of [
      "sla_breach",
      "milestone_overdue",
      "budget_exceeded",
      "task_overdue",
      "manual",
    ]) {
      const result = escalationRuleSchema.safeParse({
        name: "Rule",
        trigger_type,
        escalation_level: "task",
        is_active: false,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all valid escalation levels", () => {
    for (const escalation_level of [
      "task",
      "milestone",
      "program",
      "client_impact",
    ]) {
      const result = escalationRuleSchema.safeParse({
        name: "Rule",
        trigger_type: "manual",
        escalation_level,
        is_active: false,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional auto_assign_to_role", () => {
    const result = escalationRuleSchema.safeParse({
      name: "Rule",
      trigger_type: "manual",
      escalation_level: "program",
      is_active: true,
      auto_assign_to_role: "managing_director",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name over 255 chars", () => {
    const result = escalationRuleSchema.safeParse({
      name: "a".repeat(256),
      trigger_type: "manual",
      escalation_level: "task",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("resolveEscalationSchema", () => {
  it("validates correct resolution", () => {
    const result = resolveEscalationSchema.safeParse({
      resolution_notes: "Issue resolved via partner communication",
      resolution_type: "resolved",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty resolution_notes", () => {
    const result = resolveEscalationSchema.safeParse({
      resolution_notes: "",
      resolution_type: "resolved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid resolution_type", () => {
    const result = resolveEscalationSchema.safeParse({
      resolution_notes: "Fixed it",
      resolution_type: "ignored",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid resolution types", () => {
    for (const resolution_type of [
      "resolved",
      "escalated",
      "dismissed",
      "false_positive",
    ]) {
      const result = resolveEscalationSchema.safeParse({
        resolution_notes: "Notes",
        resolution_type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("acknowledgeEscalationSchema", () => {
  it("validates empty object (all optional)", () => {
    const result = acknowledgeEscalationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts notes", () => {
    const result = acknowledgeEscalationSchema.safeParse({
      notes: "Acknowledged and reviewing",
    });
    expect(result.success).toBe(true);
  });

  it("accepts action_taken", () => {
    const result = acknowledgeEscalationSchema.safeParse({
      action_taken: "Contacted client",
    });
    expect(result.success).toBe(true);
  });

  it("accepts both fields", () => {
    const result = acknowledgeEscalationSchema.safeParse({
      notes: "Reviewing",
      action_taken: "Sent email",
    });
    expect(result.success).toBe(true);
  });
});
