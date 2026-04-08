"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { listClientProfiles } from "@/lib/api/clients";
import { createProgram } from "@/lib/api/programs";
import { programCreateSchema, type ProgramCreateFormData } from "@/lib/validations/program";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type FormData = ProgramCreateFormData;

const STEPS = ["details", "milestones", "review"] as const;
const STEP_LABELS = ["Details", "Milestones", "Review & Budget"];

export default function NewProgramPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const isInternal = user?.role !== "client" && user?.role !== "partner";

  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: () => listClientProfiles({ limit: 200 }),
    enabled: isInternal,
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(programCreateSchema),
    defaultValues: {
      milestones: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "milestones",
  });

  const mutation = useMutation({
    mutationFn: createProgram,
    onSuccess: () => {
      router.push("/programs");
    },
    onError: () => {
      setError("Failed to create program. Please try again.");
    },
  });

  const watchedValues = watch();

  const goNext = async () => {
    if (step === 0) {
      const valid = await trigger(["client_id", "title"]);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, 2));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = (data: FormData) => {
    setError(null);
    const payload = {
      ...data,
      budget_envelope: data.budget_envelope || undefined,
      start_date: data.start_date || undefined,
      end_date: data.end_date || undefined,
      objectives: data.objectives || undefined,
      scope: data.scope || undefined,
      milestones: (data.milestones ?? []).map((m, i) => ({
        ...m,
        position: i,
        description: m.description || undefined,
        due_date: m.due_date || undefined,
      })),
    };
    mutation.mutate(payload);
  };

  if (!isInternal) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const selectedClient = clientsData?.profiles.find(
    (c) => c.id === watchedValues.client_id
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="font-serif text-3xl font-bold tracking-tight">
          New Program
        </h1>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={STEPS[step]} className="space-y-6">
            <TabsList>
              {STEPS.map((s, i) => (
                <TabsTrigger key={s} value={s} disabled>
                  {i + 1}. {STEP_LABELS[i]}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Program Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_id">Client</Label>
                    <Select
                      value={watchedValues.client_id ?? ""}
                      onValueChange={(val) => setValue("client_id", val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsData?.profiles.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.display_name || client.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.client_id && (
                      <p className="text-sm text-destructive">
                        {errors.client_id.message}
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
                    <Label htmlFor="objectives">Objectives</Label>
                    <Textarea id="objectives" {...register("objectives")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Textarea id="scope" {...register("scope")} />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="button" onClick={goNext}>
                  Next
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="milestones" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dates & Milestones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        {...register("start_date")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        {...register("end_date")}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Milestones</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          append({ title: "", description: "", due_date: "", position: fields.length })
                        }
                      >
                        Add Milestone
                      </Button>
                    </div>

                    {fields.map((field, index) => (
                      <Card key={field.id}>
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Milestone {index + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              {...register(`milestones.${index}.title`)}
                            />
                            {errors.milestones?.[index]?.title && (
                              <p className="text-sm text-destructive">
                                {errors.milestones[index].title?.message}
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Input
                                {...register(
                                  `milestones.${index}.description`
                                )}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Due Date</Label>
                              <Input
                                type="date"
                                {...register(`milestones.${index}.due_date`)}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {fields.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No milestones added yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={goBack}>
                  Back
                </Button>
                <Button type="button" onClick={goNext}>
                  Next
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="review" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Review & Budget</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget_envelope">
                      Budget Envelope (USD)
                    </Label>
                    <Input
                      id="budget_envelope"
                      type="number"
                      step="0.01"
                      {...register("budget_envelope", { valueAsNumber: true })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Client</p>
                        <p className="font-medium">
                          {selectedClient
                            ? selectedClient.display_name ||
                              selectedClient.legal_name
                            : "-"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Title</p>
                        <p className="font-medium">
                          {watchedValues.title || "-"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">
                          Start Date
                        </p>
                        <p className="font-medium">
                          {watchedValues.start_date || "-"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">
                          End Date
                        </p>
                        <p className="font-medium">
                          {watchedValues.end_date || "-"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {watchedValues.objectives && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">
                          Objectives
                        </p>
                        <p className="text-sm">{watchedValues.objectives}</p>
                      </CardContent>
                    </Card>
                  )}

                  {watchedValues.milestones &&
                    watchedValues.milestones.length > 0 && (
                      <Card>
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground mb-2">
                            Milestones ({watchedValues.milestones.length})
                          </p>
                          <ul className="space-y-1">
                            {watchedValues.milestones.map((m, i) => (
                              <li key={i} className="text-sm">
                                {i + 1}. {m.title || "(untitled)"}
                                {m.due_date && ` - due ${m.due_date}`}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={goBack}>
                  Back
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Creating..." : "Create Program"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </form>
      </div>
    </div>
  );
}
