import { format, parseISO } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AvailableSlot, MeetingType } from "@/types/meeting";

interface BookedConfirmationProps {
  selectedType: MeetingType | null;
  selectedSlot: AvailableSlot | null;
  onReset: () => void;
}

export function BookedConfirmation({
  selectedType,
  selectedSlot,
  onReset,
}: BookedConfirmationProps) {
  return (
    <Card className="max-w-md mx-auto text-center py-8">
      <CardContent className="flex flex-col items-center gap-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <div>
          <h2 className="text-xl font-semibold">Meeting Requested</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Your <span className="font-medium">{selectedType?.label}</span> on{" "}
            <span className="font-medium">
              {selectedSlot
                ? format(
                    parseISO(selectedSlot.start_time),
                    "EEE MMM d 'at' h:mm a"
                  )
                : ""}
            </span>{" "}
            has been submitted and is awaiting confirmation from your RM.
          </p>
        </div>
        <Button variant="outline" onClick={onReset}>
          Book Another Meeting
        </Button>
      </CardContent>
    </Card>
  );
}
