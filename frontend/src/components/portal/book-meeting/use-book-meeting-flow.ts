"use client";

import { useState } from "react";
import { addDays, format, startOfToday } from "date-fns";
import {
  useAvailableSlots,
  useBookMeeting,
  useMeetingTypes,
} from "@/hooks/use-meetings";
import type { AvailableSlot, MeetingType } from "@/types/meeting";
import type { Step } from "./shared";

interface UseBookMeetingFlowOptions {
  onBooked?: () => void;
}

export function useBookMeetingFlow({ onBooked }: UseBookMeetingFlowOptions) {
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<MeetingType | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [agenda, setAgenda] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [booked, setBooked] = useState(false);

  const today = startOfToday();
  const weekStart = addDays(today, weekOffset * 7);
  const weekEnd = addDays(weekStart, 13);

  const { data: meetingTypes, isLoading: typesLoading } = useMeetingTypes();

  const slotsEnabled = step === "slot" && !!selectedType;
  const { data: slotsData, isLoading: slotsLoading } = useAvailableSlots(
    {
      meeting_type_id: selectedType?.id ?? "",
      from_date: format(weekStart, "yyyy-MM-dd"),
      to_date: format(weekEnd, "yyyy-MM-dd"),
    },
    slotsEnabled
  );

  const bookMutation = useBookMeeting();

  const slotsByDate = new Map<string, AvailableSlot[]>();
  for (const slot of slotsData?.slots ?? []) {
    const key = slot.date;
    if (!slotsByDate.has(key)) slotsByDate.set(key, []);
    slotsByDate.get(key)!.push(slot);
  }

  const days = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));

  const reset = () => {
    setStep("type");
    setSelectedType(null);
    setSelectedSlot(null);
    setAgenda("");
    setBooked(false);
    setWeekOffset(0);
  };

  const handleBooking = async () => {
    if (!selectedType || !selectedSlot) return;
    try {
      await bookMutation.mutateAsync({
        meeting_type_id: selectedType.id,
        start_time: selectedSlot.start_time,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        agenda: agenda || undefined,
      });
      setBooked(true);
      onBooked?.();
    } catch {
      // error is exposed via bookMutation.error
    }
  };

  return {
    step,
    setStep,
    selectedType,
    setSelectedType,
    selectedSlot,
    setSelectedSlot,
    agenda,
    setAgenda,
    weekOffset,
    setWeekOffset,
    booked,
    today,
    weekStart,
    weekEnd,
    meetingTypes,
    typesLoading,
    slotsData,
    slotsLoading,
    slotsByDate,
    days,
    bookMutation,
    handleBooking,
    reset,
  };
}
