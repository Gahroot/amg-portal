/**
 * Soft-gating wrapper that runs the device-integrity check on mount and
 * surfaces a non-blocking warning banner if the device looks compromised.
 *
 * Behaviour matches `docs/security-plan.md` §7.13:
 *   - Default: warn-and-continue ("Continue anyway" + audit acknowledgement)
 *   - Hard-gate: enable via `EXPO_PUBLIC_HARD_GATE_JAILBREAK=true`
 *
 * Style mirrors `mobile/components/BiometricPrompt.tsx`.
 *
 * Source pattern (root/jailbreak gating UI): GantMan/jail-monkey ExampleProject/App.tsx
 */

import { ShieldAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  checkDeviceIntegrity,
  isReportSuspicious,
  postIntegrityEvent,
} from "@/lib/device-integrity";
import type { DeviceIntegrityReport } from "@/types/device-integrity";

const HARD_GATE = process.env.EXPO_PUBLIC_HARD_GATE_JAILBREAK === "true";

interface DeviceIntegrityGateProps {
  children: React.ReactNode;
}

export function DeviceIntegrityGate({ children }: DeviceIntegrityGateProps) {
  const [report, setReport] = useState<DeviceIntegrityReport | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await checkDeviceIntegrity();
      if (cancelled) return;
      setReport(result);
      setIsChecking(false);

      if (isReportSuspicious(result)) {
        // Fire-and-forget — endpoint may not exist yet (Phase 3.6 stub).
        void postIntegrityEvent(HARD_GATE ? "block" : "warn", result);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isChecking) {
    return <>{children}</>;
  }

  const suspicious = report ? isReportSuspicious(report) : false;

  if (suspicious && HARD_GATE && !acknowledged) {
    return <HardGateScreen report={report!} />;
  }

  return (
    <>
      {children}
      {suspicious && !acknowledged ? (
        <SoftGateBanner
          report={report!}
          onAcknowledge={() => {
            setAcknowledged(true);
            void postIntegrityEvent("acknowledged", report!);
          }}
        />
      ) : null}
    </>
  );
}

function SoftGateBanner({
  report,
  onAcknowledge,
}: {
  report: DeviceIntegrityReport;
  onAcknowledge: () => void;
}) {
  return (
    <SafeAreaView
      edges={["top"]}
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 z-50"
    >
      <View className="mx-3 mt-2 flex-row items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 shadow-lg">
        <ShieldAlert size={20} color="#f59e0b" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-amber-200">
            Device integrity check failed
          </Text>
          <Text className="mt-1 text-xs text-amber-100/80">
            {summarize(report)} — extra restrictions may apply to sensitive
            actions.
          </Text>
          <Pressable
            onPress={onAcknowledge}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="mt-2 self-start rounded-md bg-amber-500/30 px-3 py-1.5"
          >
            <Text className="text-xs font-semibold text-amber-100">
              Continue anyway
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function HardGateScreen({ report }: { report: DeviceIntegrityReport }) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-sm items-center rounded-2xl bg-card p-6">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
          <ShieldAlert size={32} color="#ef4444" />
        </View>
        <Text className="text-center text-xl font-bold text-foreground">
          Device blocked
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          AMG Portal cannot run on this device because integrity checks
          failed: {summarize(report)}. Please use a managed device.
        </Text>
        <ActivityIndicator size="small" color="#ef4444" className="mt-4" />
      </View>
    </View>
  );
}

function summarize(report: DeviceIntegrityReport): string {
  const flags: string[] = [];
  if (report.jailbroken) flags.push("rooted/jailbroken");
  if (report.debuggerAttached) flags.push("debugger attached");
  if (report.mockLocation) flags.push("mock location");
  if (!report.signatureMatches) flags.push("signature mismatch");
  if (flags.length === 0) flags.push("unknown");
  return flags.join(", ");
}

export default DeviceIntegrityGate;
