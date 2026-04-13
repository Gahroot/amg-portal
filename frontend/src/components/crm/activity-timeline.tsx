"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  StickyNote,
  Phone,
  Mail,
  Users,
  CircleCheck,
  Plus,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_TYPES } from "@/types/crm";
import type { CrmActivity, CrmActivityType } from "@/types/crm";
import {
  useCrmActivities,
  useCreateCrmActivity,
  useDeleteCrmActivity,
} from "@/hooks/use-crm";

const ICONS: Record<CrmActivityType, React.ComponentType<{ className?: string }>> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Users,
  task: CircleCheck,
};

interface ActivityTimelineProps {
  leadId?: string;
  opportunityId?: string;
  clientProfileId?: string;
}

export function ActivityTimeline({
  leadId,
  opportunityId,
  clientProfileId,
}: ActivityTimelineProps) {
  const [type, setType] = useState<CrmActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const params = { lead_id: leadId, opportunity_id: opportunityId, client_profile_id: clientProfileId };
  const { data, isLoading } = useCrmActivities(params);
  const createMutation = useCreateCrmActivity();
  const deleteMutation = useDeleteCrmActivity();

  const handleCreate = async () => {
    if (!subject.trim()) return;
    await createMutation.mutateAsync({
      type,
      subject: subject.trim(),
      body: body.trim() || null,
      lead_id: leadId ?? null,
      opportunity_id: opportunityId ?? null,
      client_profile_id: clientProfileId ?? null,
    });
    setSubject("");
    setBody("");
  };

  const activities = data?.activities ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-3">
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="activity-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CrmActivityType)}
              >
                <SelectTrigger id="activity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activity-subject">Subject</Label>
              <Input
                id="activity-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary"
              />
            </div>
          </div>
          <Textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Details (optional)"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!subject.trim() || createMutation.isPending}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Log activity
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        )}
        {!isLoading && activities.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
        <AnimatePresence initial={false}>
          {activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              onDelete={() => deleteMutation.mutate(activity.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  onDelete,
}: {
  activity: CrmActivity;
  onDelete: () => void;
}) {
  const Icon = ICONS[activity.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.15 }}
      className="group flex gap-3 rounded-lg border bg-card p-3"
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{activity.subject}</p>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.occurred_at), {
              addSuffix: true,
            })}
          </span>
        </div>
        {activity.body && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {activity.body}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={onDelete}
        aria-label="Delete"
      >
        <Trash2 className="size-4" />
      </Button>
    </motion.div>
  );
}
