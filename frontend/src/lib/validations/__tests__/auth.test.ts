import { describe, expect, it } from "vitest";

import { passwordSchema } from "@/lib/validations/auth";

// These cases are mirrored in backend/tests/test_password_validation.py.
// Both the backend Pydantic validator and this Zod schema MUST agree.
const VALID_PASSWORDS = [
  "Abcdefg1!",
  "ZZZzzz9@",
  "Password1.",
  "Hello1\\X",
];

const INVALID_PASSWORDS: Array<{ password: string; reason: string }> = [
  { password: "Ab1!", reason: "too short" },
  { password: "Abcdefg1", reason: "no special character" },
  { password: "Abcdefg!", reason: "no digit" },
  // Backend rejects `~` as a special char; frontend used to accept it.
  // This is the bug we are fixing — both sides must now reject.
  { password: "Abcdefg1~", reason: "tilde is not an accepted special char" },
];

describe("passwordSchema", () => {
  it.each(VALID_PASSWORDS)("accepts valid password %s", (password) => {
    expect(passwordSchema.safeParse(password).success).toBe(true);
  });

  it.each(INVALID_PASSWORDS)(
    "rejects $password ($reason)",
    ({ password }) => {
      expect(passwordSchema.safeParse(password).success).toBe(false);
    },
  );
});
