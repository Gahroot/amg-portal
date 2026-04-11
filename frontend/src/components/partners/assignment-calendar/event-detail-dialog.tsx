"use client";

import Link from "next/link";
import { format, isPast, parseISO } from "date-fns";
import {
  CalendarIcon,
  ClipboardList,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { CalendarEvent } from "@/lib/api/partner-portal";
import { DONE_STATUSES, getStatusConfig } from "./types";

export interface EventDetailDialogProps {
  event: CalendarEvent | null;
  programColor: string;
  onClose: () => void;
}

export function EventDetailDialog({
  event,
  programColor,
  onClose,
}: EventDetailDialogProps) {
  if (!event) return null;

  const statusCfg = getStatusConfig(event);
  const isOverdue =
    event.due_date &&
    isPast(parseISO(event.due_date)) &&
    !DONE_STATUSES.has(event.status);

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            {event.type === "assignment" ? (
              <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {event.type === "assignment"
                ? "Assignment"
                : `Deliverable · ${event.deliverable_type ?? ""}`}
            </span>
          </div>
          <DialogTitle className="pr-6 text-base leading-snug">
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {event.program_title && (
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${programColor}`}
              />
              <span className="text-sm text-muted-foreground">
                {event.program_title}
              </span>
            </div>
          )}

          {event.type === "deliverable" && event.assignment_title && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              <span>Assignment: {event.assignment_title}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {statusCfg.icon}
            <span className={`text-sm font-medium ${statusCfg.textColor}`}>
              {statusCfg.label}
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="ml-1 text-xs">
                Overdue
              </Badge>
            )}
          </div>

          {event.due_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Due {format(parseISO(event.due_date), "MMMM d, yyyy")}</span>
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            {event.type === "assignment" ? (
              <Link
                href={`/partner/assignments/${event.assignment_id}`}
                onClick={onClose}
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Assignment
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  href={`/partner/deliverables/${event.id}`}
                  onClick={onClose}
                >
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Deliverable
                  </Button>
                </Link>
                <Link
                  href={`/partner/assignments/${event.assignment_id}`}
                  onClick={onClose}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    View Assignment
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
