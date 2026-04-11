import { format, parseISO } from "date-fns";
import { Calendar, ChevronLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AvailableSlot, MeetingType } from "@/types/meeting";

interface AgendaStepProps {
  selectedType: MeetingType;
  selectedSlot: AvailableSlot;
  agenda: string;
  setAgenda: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function AgendaStep({
  selectedType,
  selectedSlot,
  agenda,
  setAgenda,
  onBack,
  onNext,
}: AgendaStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Add details</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Optionally share an agenda so your RM can prepare.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(
                parseISO(selectedSlot.start_time),
                "EEEE, MMMM d 'at' h:mm a"
              )}
            </span>
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              {selectedType.duration_minutes} min
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="agenda">Agenda / notes (optional)</Label>
        <Textarea
          id="agenda"
          placeholder="What would you like to discuss?"
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={4}
          maxLength={2000}
        />
        <p className="text-xs text-muted-foreground text-right">
          {agenda.length}/2000
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>Review booking</Button>
      </div>
    </div>
  );
}
