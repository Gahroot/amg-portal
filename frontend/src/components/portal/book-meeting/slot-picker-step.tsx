import type { Dispatch, SetStateAction } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AvailableSlot, MeetingType } from "@/types/meeting";
import { DOW_LABELS } from "./shared";

interface SlotPickerStepProps {
  selectedType: MeetingType;
  selectedSlot: AvailableSlot | null;
  onSelectSlot: (slot: AvailableSlot) => void;
  onBack: () => void;
  onNext: () => void;
  weekOffset: number;
  setWeekOffset: Dispatch<SetStateAction<number>>;
  weekStart: Date;
  weekEnd: Date;
  days: Date[];
  today: Date;
  slotsByDate: Map<string, AvailableSlot[]>;
  slotsLoading: boolean;
  hasSlots: boolean;
}

export function SlotPickerStep({
  selectedType,
  selectedSlot,
  onSelectSlot,
  onBack,
  onNext,
  weekOffset,
  setWeekOffset,
  weekStart,
  weekEnd,
  days,
  today,
  slotsByDate,
  slotsLoading,
  hasSlots,
}: SlotPickerStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pick a time</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Available slots for a{" "}
            <span className="font-medium">{selectedType.label}</span> (
            {selectedType.duration_minutes} min).
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          disabled={weekOffset === 0}
          onClick={() => setWeekOffset((w) => w - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setWeekOffset((w) => w + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {slotsLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Loading available slots…
        </div>
      ) : !hasSlots ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No available slots in this period. Try the next week.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const daySlots = slotsByDate.get(key) ?? [];
            const isToday = isSameDay(day, today);
            return (
              <div key={key} className="min-h-[80px]">
                <div
                  className={cn(
                    "text-xs text-center mb-1 font-medium",
                    isToday && "text-primary"
                  )}
                >
                  <div>
                    {DOW_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                  </div>
                  <div
                    className={cn(
                      "rounded-full w-6 h-6 flex items-center justify-center mx-auto text-xs",
                      isToday && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {daySlots.map((slot) => {
                    const isSelected =
                      selectedSlot?.start_time === slot.start_time;
                    return (
                      <button
                        key={slot.start_time}
                        className={cn(
                          "w-full text-xs rounded py-1 px-1 border transition-colors",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-accent border-border"
                        )}
                        onClick={() => onSelectSlot(slot)}
                      >
                        {format(parseISO(slot.start_time), "HH:mm")}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={!selectedSlot} onClick={onNext}>
          Next: Add details
        </Button>
      </div>
    </div>
  );
}
