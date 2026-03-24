"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { listPartners } from "@/lib/api/partners";
import { listPrograms } from "@/lib/api/programs";
import {
  createAssignment,
  dispatchAssignment,
} from "@/lib/api/assignments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const createAssignmentSchema = z.object({
  partner_id: z.string().min(1, "Partner is required"),
  program_id: z.string().min(1, "Program is required"),
  title: z.string().min(1, "Title is required"),
  brief: z.string().min(1, "Brief is required"),
  sla_terms: z.string().optional(),
  due_date: z.string().optional(),
});

type CreateAssignmentFormData = z.infer<typeof createAssignmentSchema>;

export default function NewAssignmentPage() {
  const { user } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssignmentFormData>({
    resolver: zodResolver(createAssignmentSchema),
  });

  const { data: partnersData } = useQuery({
    queryKey: ["partners"],
    queryFn: () => listPartners({ status: "active" }),
  });

  const { data: programsData } = useQuery({
    queryKey: ["programs"],
    queryFn: () => listPrograms(),
  });

  const createMutation = useMutation({
    mutationFn: createAssignment,
  });

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => dispatchAssignment(id),
  });

  const isInternal = user?.role !== "client" && user?.role !== "partner";

  if (!isInternal) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const onSubmit = async (
    data: CreateAssignmentFormData,
    shouldDispatch: boolean
  ) => {
    try {
      const assignment = await createMutation.mutateAsync({
        partner_id: data.partner_id,
        program_id: data.program_id,
        title: data.title,
        brief: data.brief,
        sla_terms: data.sla_terms || undefined,
        due_date: data.due_date || undefined,
      });
      if (shouldDispatch) {
        await dispatchMutation.mutateAsync(assignment.id);
      }
      toast.success(shouldDispatch ? "Assignment created and dispatched" : "Assignment saved as draft");
      router.push("/assignments");
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create assignment. Please try again.";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">
              Create New Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Partner</Label>
                <Select
                  onValueChange={(value) => setValue("partner_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnersData?.profiles.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.firm_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.partner_id && (
                  <p className="text-sm text-destructive">
                    {errors.partner_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Program</Label>
                <Select
                  onValueChange={(value) => setValue("program_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programsData?.programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.program_id && (
                  <p className="text-sm text-destructive">
                    {errors.program_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" {...register("title")} />
                {errors.title && (
                  <p className="text-sm text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="brief">Brief</Label>
                <Textarea id="brief" {...register("brief")} />
                {errors.brief && (
                  <p className="text-sm text-destructive">
                    {errors.brief.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sla_terms">SLA Terms (optional)</Label>
                <Textarea id="sla_terms" {...register("sla_terms")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date (optional)</Label>
                <Input
                  id="due_date"
                  type="date"
                  {...register("due_date")}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  disabled={isSubmitting || createMutation.isPending}
                  onClick={handleSubmit((data) => onSubmit(data, false))}
                >
                  {createMutation.isPending ? "Saving..." : "Save as Draft"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isSubmitting ||
                    createMutation.isPending ||
                    dispatchMutation.isPending
                  }
                  onClick={handleSubmit((data) => onSubmit(data, true))}
                >
                  {dispatchMutation.isPending
                    ? "Dispatching..."
                    : "Save & Dispatch"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/assignments")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
