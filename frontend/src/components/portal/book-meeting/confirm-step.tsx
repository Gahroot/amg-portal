import { format, parseISO } from "date-fns";
import { Calendar, ChevronLeft, Clock, Video } from "lucide-react";
import type { useBookMeeting } from "@/hooks/use-meetings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AvailableSlot, MeetingType } from "@/types/meeting";
import { durationBadgeColor } from "./shared";

interface ConfirmStepProps {
  selectedType: MeetingType;
  selectedSlot: AvailableSlot;
  agenda: string;
  onBack: () => void;
  onChangeTime: () => void;
  onConfirm: () => void;
  bookMutation: ReturnType<typeof useBookMeeting>;
}

export function ConfirmStep({
  selectedType,
  selectedSlot,
  agenda,
  onBack,
  onChangeTime,
  onConfirm,
  bookMutation,
}: ConfirmStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Confirm your booking</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review the details below, then confirm.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            {selectedType.label}
            <Badge
              variant="outline"
              className={cn(
                "ml-auto text-xs",
                durationBadgeColor(selectedType.duration_minutes)
              )}
            >
              {selectedType.duration_minutes} min
            </Badge>
          </CardTitle>
          <CardDescription>{selectedType.description}</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>
              {format(parseISO(selectedSlot.start_time), "EEEE, MMMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>
              {format(parseISO(selectedSlot.start_time), "h:mm a")} –{" "}
              {format(parseISO(selectedSlot.end_time), "h:mm a")} (
              {Intl.DateTimeFormat().resolvedOptions().timeZone})
            </span>
          </div>
          {agenda && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="font-medium mb-1">Agenda</p>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {agenda}
                </p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          {bookMutation.error && (
            <p className="text-sm text-destructive mr-auto">
              {bookMutation.error instanceof Error
                ? bookMutation.error.message
                : "Booking failed. Please try again."}
            </p>
          )}
          <Button
            variant="outline"
            onClick={onChangeTime}
            disabled={bookMutation.isPending}
          >
            Change time
          </Button>
          <Button onClick={onConfirm} disabled={bookMutation.isPending}>
            {bookMutation.isPending ? "Booking…" : "Confirm meeting"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
