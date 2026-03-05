"use client";

import { format } from "date-fns";
import type { DecisionRequest } from "@/types/communication";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, XCircle, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

interface DecisionRequestCardProps {
  decision: DecisionRequest;
  onResponse?: () => void;
  onViewDetails?: () => void;
}

const statusConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-orange-500", label: "Pending" },
  responded: { icon: CheckCircle, color: "text-green-500", label: "Responded" },
  declined: { icon: XCircle, color: "text-red-500", label: "Declined" },
  expired: { icon: Hourglass, color: "text-gray-500", label: "Expired" },
  cancelled: { icon: XCircle, color: "text-gray-500", label: "Cancelled" },
};

export function DecisionRequestCard({ decision, onResponse, onViewDetails }: DecisionRequestCardProps) {
  const config = statusConfig[decision.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const hasDeadline = decision.deadline_date;
  const isOverdue = hasDeadline && decision.deadline_date && new Date(decision.deadline_date) < new Date() && decision.status === "pending";

  return (
    <Card className={cn("transition-shadow hover:shadow-md", isOverdue && "border-orange-500/50")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{decision.title}</CardTitle>
            <CardDescription className="mt-1">{decision.prompt}</CardDescription>
          </div>
          <Badge variant="outline" className={cn("gap-1", config.color)}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Response Type */}
        <div className="mb-2">
          <Badge variant="secondary" className="text-xs">
            {decision.response_type.replace(/_/g, " ")}
          </Badge>
        </div>

        {/* Options Preview */}
        {decision.options && decision.options.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-xs text-muted-foreground">Options:</p>
            <div className="flex flex-wrap gap-1">
              {decision.options.slice(0, 3).map((option) => (
                <Badge key={option.id} variant="outline" className="text-xs">
                  {option.label}
                </Badge>
              ))}
              {decision.options.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{decision.options.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Deadline */}
        {hasDeadline && decision.deadline_date && (
          <div className={cn("flex items-center gap-1 text-xs", isOverdue ? "text-orange-500" : "text-muted-foreground")}>
            <Clock className="h-3 w-3" />
            <span>
              {isOverdue ? "Overdue: " : "Deadline: "}
              {format(new Date(decision.deadline_date), "MMM d, yyyy")}
              {decision.deadline_time && ` at ${format(new Date(`2000-01-01T${decision.deadline_time}`), "h:mm a")}`}
            </span>
          </div>
        )}

        {/* Consequence */}
        {decision.consequence_text && isOverdue && (
          <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
            {decision.consequence_text}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={onViewDetails}>
          View Details
        </Button>
        {decision.status === "pending" && (
          <Button size="sm" onClick={onResponse}>
            Respond
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
