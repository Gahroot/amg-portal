/**
 * Device-integrity wire shape shared between the mobile client and the
 * (future) backend `/api/v1/security/device-integrity` endpoint.
 *
 * See `docs/security-plan.md` §7.13 (Mobile) and §6 Phase 3.6.
 *
 * Source pattern (the field set roughly follows the JailMonkey example app):
 *   GantMan/jail-monkey ExampleProject/App.tsx
 */

/** A single integrity report produced by `checkDeviceIntegrity()`. */
export interface DeviceIntegrityReport {
  /** Device is jailbroken (iOS) or rooted (Android). */
  jailbroken: boolean;
  /** A debugger is attached to the running app process. */
  debuggerAttached: boolean;
  /** Mock-location providers are enabled (Android) / suspected (iOS). */
  mockLocation: boolean;
  /** Running on an emulator/simulator. */
  emulator: boolean;
  /**
   * App signature matches the expected production signature (Android only).
   * Always `true` on iOS and on platforms where the check is unavailable.
   */
  signatureMatches: boolean;
  /** ISO-8601 timestamp when the report was generated. */
  checkedAt: string;
}

/** Compact digest header value: e.g. `j=0;d=0;m=0;e=0;s=1`. */
export type DeviceIntegrityHeader = string;

/**
 * Request body posted to the backend on a failed integrity check.
 *
 * Matches the (future) backend shape — keep in lockstep with the Pydantic
 * schema once Phase 3.6 backend handler ships.
 */
export interface DeviceIntegrityEvent {
  report: DeviceIntegrityReport;
  /** `"warn"` for soft-gated continue, `"block"` when hard-gate triggers. */
  outcome: "warn" | "block" | "acknowledged";
  /** App version + platform — populated by `device-integrity.ts`. */
  app_version: string;
  platform: "ios" | "android" | "web";
}
