"use client";

import { AgendaStep } from "./book-meeting/agenda-step";
import { BookedConfirmation } from "./book-meeting/booked-confirmation";
import { ConfirmStep } from "./book-meeting/confirm-step";
import { MeetingTypeStep } from "./book-meeting/meeting-type-step";
import { ProgressIndicator } from "./book-meeting/progress-indicator";
import { SlotPickerStep } from "./book-meeting/slot-picker-step";
import { useBookMeetingFlow } from "./book-meeting/use-book-meeting-flow";

export { MyMeetingsList } from "./book-meeting/my-meetings-list";

interface BookMeetingProps {
  onBooked?: () => void;
}

export function BookMeeting({ onBooked }: BookMeetingProps) {
  const flow = useBookMeetingFlow({ onBooked });

  if (flow.booked) {
    return (
      <BookedConfirmation
        selectedType={flow.selectedType}
        selectedSlot={flow.selectedSlot}
        onReset={flow.reset}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ProgressIndicator step={flow.step} />

      {flow.step === "type" && (
        <MeetingTypeStep
          meetingTypes={flow.meetingTypes}
          typesLoading={flow.typesLoading}
          selectedType={flow.selectedType}
          onSelect={flow.setSelectedType}
          onNext={() => flow.setStep("slot")}
        />
      )}

      {flow.step === "slot" && flow.selectedType && (
        <SlotPickerStep
          selectedType={flow.selectedType}
          selectedSlot={flow.selectedSlot}
          onSelectSlot={flow.setSelectedSlot}
          onBack={() => flow.setStep("type")}
          onNext={() => flow.setStep("agenda")}
          weekOffset={flow.weekOffset}
          setWeekOffset={flow.setWeekOffset}
          weekStart={flow.weekStart}
          weekEnd={flow.weekEnd}
          days={flow.days}
          today={flow.today}
          slotsByDate={flow.slotsByDate}
          slotsLoading={flow.slotsLoading}
          hasSlots={!!flow.slotsData?.slots.length}
        />
      )}

      {flow.step === "agenda" && flow.selectedSlot && flow.selectedType && (
        <AgendaStep
          selectedType={flow.selectedType}
          selectedSlot={flow.selectedSlot}
          agenda={flow.agenda}
          setAgenda={flow.setAgenda}
          onBack={() => flow.setStep("slot")}
          onNext={() => flow.setStep("confirm")}
        />
      )}

      {flow.step === "confirm" && flow.selectedSlot && flow.selectedType && (
        <ConfirmStep
          selectedType={flow.selectedType}
          selectedSlot={flow.selectedSlot}
          agenda={flow.agenda}
          onBack={() => flow.setStep("agenda")}
          onChangeTime={() => flow.setStep("slot")}
          onConfirm={flow.handleBooking}
          bookMutation={flow.bookMutation}
        />
      )}
    </div>
  );
}
