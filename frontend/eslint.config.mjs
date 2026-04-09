import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // React 17+ JSX transform makes `import * as React` unnecessary.
      // Use named imports instead: `import { useState, useEffect } from "react"`.
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "react",
              importNames: ["default"],
              message:
                'Use named imports from "react" instead of `import * as React` or `import React`. ' +
                'Example: import { useState, useEffect } from "react"',
            },
          ],
        },
      ],
      // React Compiler rules — disabled while codebase is incrementally migrated.
      // These flag common patterns (setState in effects, ref reads during render,
      // manual memoization mismatches) that require deep refactoring per-component.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
