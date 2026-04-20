/**
 * Mobile device-integrity check (jailbreak / root / emulator / debugger).
 *
 * Wraps `jail-monkey` (https://github.com/GantMan/jail-monkey) — a small
 * native module exposing per-platform root/jailbreak/hook/mock-location
 * checks. The library requires a custom dev-client / EAS build (it is NOT
 * available in Expo Go); on web and on builds without the native module
 * we fall back to safe defaults so the app never hard-crashes.
 *
 * See `docs/security-plan.md` §7.13 (Mobile) and §6 Phase 3.6.
 *
 * Source pattern: GantMan/jail-monkey ExampleProject/App.tsx — `JailMonkey.isJailBroken()`,
 * `canMockLocation()`, `isDebuggedMode()`, `hookDetected()`.
 *
 * TODO(security-plan §7.13): wire `postIntegrityEvent` to a real backend
 * endpoint at `/api/v1/security/device-integrity` once the Phase 3.6
 * backend handler ships. Until then the POST silently no-ops on 404.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

import api from "@/lib/api";
import type {
  DeviceIntegrityEvent,
  DeviceIntegrityHeader,
  DeviceIntegrityReport,
} from "@/types/device-integrity";

// `jail-monkey` is an optional native module — `require` it lazily inside a
// try/catch so Expo Go (and web) keep working. When it's missing every
// boolean defaults to a safe `false`.
type JailMonkeyApi = {
  isJailBroken: () => boolean;
  canMockLocation: () => boolean;
  isDebuggedMode: () => Promise<boolean>;
  hookDetected?: () => boolean;
  isOnExternalStorage?: () => boolean;
  AdbEnabled?: () => Promise<boolean>;
};

let jailMonkey: JailMonkeyApi | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jailMonkey = require("jail-monkey").default as JailMonkeyApi;
} catch {
  jailMonkey = null;
}

const SAFE_DEFAULT: DeviceIntegrityReport = {
  jailbroken: false,
  debuggerAttached: false,
  mockLocation: false,
  emulator: false,
  signatureMatches: true,
  checkedAt: new Date(0).toISOString(),
};

let lastReport: DeviceIntegrityReport = SAFE_DEFAULT;

/**
 * Run all available integrity checks and return a single report.
 * Web, Expo Go, and any platform where the native module is unavailable
 * resolve to a safe-default report (everything false / signature OK).
 */
export async function checkDeviceIntegrity(): Promise<DeviceIntegrityReport> {
  if (Platform.OS === "web" || !jailMonkey) {
    lastReport = { ...SAFE_DEFAULT, checkedAt: new Date().toISOString() };
    return lastReport;
  }

  let debuggerAttached = false;
  try {
    debuggerAttached = await jailMonkey.isDebuggedMode();
  } catch {
    debuggerAttached = false;
  }

  // jail-monkey's emulator check lives behind `trustFall()` / hookDetected()
  // historically; we treat the simulator/emulator flag as "running outside a
  // real device" — Expo's Constants surface tells us this without a native
  // call and works on iOS + Android.
  const emulator = !Constants.isDevice;

  const report: DeviceIntegrityReport = {
    jailbroken: safeBool(() => jailMonkey?.isJailBroken()),
    debuggerAttached,
    mockLocation: safeBool(() => jailMonkey?.canMockLocation()),
    emulator,
    // Signature pinning is Android-only and requires a release build with the
    // expected SHA wired in. For Phase 3.6 we don't ship that wiring yet —
    // leave `true` so the gate doesn't false-positive in dev/EAS preview.
    signatureMatches: true,
    checkedAt: new Date().toISOString(),
  };

  lastReport = report;
  return report;
}

function safeBool(fn: () => boolean | undefined): boolean {
  try {
    return Boolean(fn());
  } catch {
    return false;
  }
}

/** The most recent report — useful for sync header building. */
export function getLastIntegrityReport(): DeviceIntegrityReport {
  return lastReport;
}

/**
 * Compact header form: `j=0;d=0;m=0;e=0;s=1`.
 * Used in the `X-Device-Integrity` request header so the backend can decide
 * whether to flag the session without parsing the full JSON report.
 */
export function buildIntegrityHeader(
  report: DeviceIntegrityReport = lastReport,
): DeviceIntegrityHeader {
  return [
    `j=${report.jailbroken ? 1 : 0}`,
    `d=${report.debuggerAttached ? 1 : 0}`,
    `m=${report.mockLocation ? 1 : 0}`,
    `e=${report.emulator ? 1 : 0}`,
    `s=${report.signatureMatches ? 1 : 0}`,
  ].join(";");
}

/**
 * POST a device-integrity event to the backend. Phase-3.6 stub: failures
 * are swallowed (the endpoint may not exist yet). Re-enable strict error
 * propagation once the backend route is live.
 */
export async function postIntegrityEvent(
  outcome: DeviceIntegrityEvent["outcome"],
  report: DeviceIntegrityReport = lastReport,
): Promise<void> {
  const body: DeviceIntegrityEvent = {
    report,
    outcome,
    app_version: Constants.expoConfig?.version ?? "0.0.0",
    platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
  };

  try {
    await api.post("/security/device-integrity", body);
  } catch {
    // TODO(security-plan §7.13): backend route not implemented yet — swallow.
  }
}

/** Convenience: should the integrity report trigger any UI gating? */
export function isReportSuspicious(report: DeviceIntegrityReport): boolean {
  return (
    report.jailbroken ||
    report.debuggerAttached ||
    report.mockLocation ||
    !report.signatureMatches
  );
}
