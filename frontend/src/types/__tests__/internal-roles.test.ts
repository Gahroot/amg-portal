import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { INTERNAL_ROLES } from "@/types/user";

/**
 * Parse the `INTERNAL_ROLES` constant out of `mobile/types/user.ts` by
 * reading the file verbatim. Mobile is a separate package with its own
 * module resolution, so importing the symbol directly would pull Expo
 * runtime dependencies into the Vitest environment.
 */
function readMobileInternalRoles(): string[] {
  const mobileUserTsPath = path.resolve(
    __dirname,
    "../../../../mobile/types/user.ts",
  );
  const source = readFileSync(mobileUserTsPath, "utf8");
  const match = source.match(
    /INTERNAL_ROLES:\s*UserRole\[\]\s*=\s*\[([\s\S]*?)\];/,
  );
  if (!match) {
    throw new Error(
      `Unable to locate INTERNAL_ROLES declaration in ${mobileUserTsPath}`,
    );
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

describe("INTERNAL_ROLES cross-package sync", () => {
  it("frontend and mobile INTERNAL_ROLES must be identical", () => {
    const mobileRoles = readMobileInternalRoles();
    expect(mobileRoles).toEqual(INTERNAL_ROLES);
  });
});
