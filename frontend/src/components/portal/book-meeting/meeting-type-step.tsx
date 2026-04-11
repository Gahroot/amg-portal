import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MeetingType } from "@/types/meeting";
import { durationBadgeColor } from "./shared";

interface MeetingTypeStepProps {
  meetingTypes: MeetingType[] | undefined;
  typesLoading: boolean;
  selectedType: MeetingType | null;
  onSelect: (type: MeetingType) => void;
  onNext: () => void;
}

export function MeetingTypeStep({
  meetingTypes,
  typesLoading,
  selectedType,
  onSelect,
  onNext,
}: MeetingTypeStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Choose a meeting type</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select how long you&apos;d like to meet with your Relationship Manager.
        </p>
      </div>
      {typesLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-3">
          {meetingTypes?.map((type) => (
            <Card
              key={type.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-sm border-2",
                selectedType?.id === type.id ? "border-primary" : "border-border"
              )}
              onClick={() => onSelect(type)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{type.label}</CardTitle>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      durationBadgeColor(type.duration_minutes)
                    )}
                  >
                    <Clock className="inline h-3 w-3 mr-1" />
                    {type.duration_minutes} min
                  </span>
                </div>
              </CardHeader>
              {type.description && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    {type.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button disabled={!selectedType} onClick={onNext}>
          Next: Pick a time
        </Button>
      </div>
    </div>
  );
}
