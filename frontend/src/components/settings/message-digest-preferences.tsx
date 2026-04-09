"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getDigestPreferences,
  updateDigestPreferences,
  previewDigest,
} from "@/lib/api/messaging";
import type {
  DigestFrequency,
  DigestPreviewResponse,
} from "@/types/communication";

const DIGEST_FREQUENCIES: { value: DigestFrequency; label: string }[] = [
  { value: "immediate", label: "Immediate (every message)" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "never", label: "Never" },
];

export function MessageDigestPreferences() {
  const queryClient = useQueryClient();
  const [frequency, setFrequency] = useState<DigestFrequency>("daily");
  const [hasChanges, setHasChanges] = useState(false);
  const [preview, setPreview] = useState<DigestPreviewResponse | null>(
    null
  );

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["message-digest-preferences"],
    queryFn: getDigestPreferences,
  });

  const updateMutation = useMutation({
    mutationFn: (newFrequency: DigestFrequency) =>
      updateDigestPreferences({ digest_frequency: newFrequency }),
    onSuccess: () => {
      toast.success("Message digest preferences updated");
      queryClient.invalidateQueries({
        queryKey: ["message-digest-preferences"],
      });
      setHasChanges(false);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to update preferences";
      toast.error(message);
    },
  });

  const previewMutation = useMutation({
    mutationFn: previewDigest,
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: () => {
      toast.error("Failed to load digest preview");
    },
  });

  useEffect(() => {
    if (preferences) {
      setFrequency(preferences.digest_frequency as DigestFrequency);
      setHasChanges(false);
    }
  }, [preferences]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message Digest</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Loading preferences...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Digest</CardTitle>
        <CardDescription>
          Control how often you receive email summaries of unread conversation
          messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Digest Frequency</Label>
          <Select
            value={frequency}
            onValueChange={(v) => {
              setFrequency(v as DigestFrequency);
              setHasChanges(true);
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIGEST_FREQUENCIES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {frequency === "never"
              ? "You will not receive message digest emails."
              : frequency === "immediate"
                ? "You\u2019ll get an email for every new message."
                : `You\u2019ll receive a digest email ${frequency}.`}
          </p>
        </div>

        {preferences?.last_digest_sent_at && (
          <p className="text-xs text-muted-foreground">
            Last digest sent:{" "}
            {new Date(preferences.last_digest_sent_at).toLocaleString()}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            onClick={() => updateMutation.mutate(frequency)}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={() => previewMutation.mutate()}
            disabled={previewMutation.isPending}
          >
            {previewMutation.isPending ? "Loading..." : "Preview Digest"}
          </Button>
        </div>

        {preview && (
          <div className="rounded-md border p-4 space-y-3">
            <h4 className="text-sm font-medium">
              Digest Preview ({preview.unread_count} unread message
              {preview.unread_count !== 1 ? "s" : ""})
            </h4>
            {preview.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No unread messages — your digest would be empty.
              </p>
            ) : (
              <div className="divide-y">
                {preview.messages.map((msg) => (
                  <div key={msg.message_id} className="py-2 space-y-0.5">
                    <div className="text-sm">
                      <span className="font-medium">
                        {msg.sender_name ?? "Unknown"}
                      </span>{" "}
                      in{" "}
                      <span className="italic">
                        {msg.conversation_title ?? "Conversation"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {msg.body_preview}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {new Date(msg.sent_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
