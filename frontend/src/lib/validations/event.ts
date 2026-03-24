import { z } from "zod/v4";

// Event type enum
export const eventTypeSchema = z.enum([
  "meeting",
  "call",
  "site_visit",
  "review",
  "deadline",
]);

// Event form schema
export const eventFormSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional(),
    event_type: eventTypeSchema,
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    location: z.string().optional(),
    virtual_link: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    notes: z.string().optional(),
    reminder_minutes: z.number().min(0).max(10080).optional(), // Max 1 week
    attendees: z.array(z.string()).optional(),
    client_id: z.string().optional(),
    program_id: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.start_time && data.end_time) {
        return new Date(data.start_time) < new Date(data.end_time);
      }
      return true;
    },
    {
      message: "End time must be after start time",
      path: ["end_time"],
    }
  );

// Event create schema
export const eventCreateSchema = eventFormSchema;

// Event update schema
export const eventUpdateSchema = eventFormSchema.partial();

// Event filter schema
export const eventFilterSchema = z.object({
  event_type: eventTypeSchema.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  client_id: z.string().optional(),
  program_id: z.string().optional(),
});

// Type exports
export type EventType = z.infer<typeof eventTypeSchema>;
export type EventFormData = z.infer<typeof eventFormSchema>;
export type EventCreateFormData = z.infer<typeof eventCreateSchema>;
export type EventUpdateFormData = z.infer<typeof eventUpdateSchema>;
export type EventFilterFormData = z.infer<typeof eventFilterSchema>;
