"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/auth-provider";
import { useCreateClientProfile } from "@/hooks/use-clients";
import { toast } from "sonner";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ENTITY_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "corporation", label: "Corporation" },
  { value: "trust", label: "Trust" },
  { value: "partnership", label: "Partnership" },
  { value: "foundation", label: "Foundation" },
  { value: "other", label: "Other" },
];

const COMMUNICATION_PREFS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "in_person", label: "In Person" },
  { value: "portal", label: "Portal" },
];

const ALLOWED_ROLES = [
  "relationship_manager",
  "managing_director",
  "coordinator",
  "finance_compliance",
];

const createClientSchema = z.object({
  legal_name: z.string().min(1, "Legal name is required"),
  display_name: z.string().optional(),
  entity_type: z.string().optional(),
  jurisdiction: z.string().optional(),
  tax_id: z.string().optional(),
  primary_email: z.email("Please enter a valid email address"),
  secondary_email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  communication_preference: z.string().optional(),
  sensitivities: z.string().optional(),
  special_instructions: z.string().optional(),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

export default function NewClientPage() {
  const { user } = useAuth();
  const router = useRouter();
  const createMutation = useCreateClientProfile();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const onSubmit = async (data: CreateClientFormData) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Client created successfully");
      router.push("/clients");
    } catch {
      // Error is handled by the hook's onError callback
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-6">
          New Client Profile
        </h1>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-xl">Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="legal_name">Legal Name *</Label>
                    <Input id="legal_name" {...register("legal_name")} />
                    {errors.legal_name && (
                      <p className="text-sm text-destructive">
                        {errors.legal_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input id="display_name" {...register("display_name")} />
                  </div>

                  <div className="space-y-2">
                    <Label>Entity Type</Label>
                    <Select
                      onValueChange={(value) => setValue("entity_type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select entity type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jurisdiction">Jurisdiction</Label>
                    <Input id="jurisdiction" {...register("jurisdiction")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tax_id">Tax ID</Label>
                    <Input id="tax_id" {...register("tax_id")} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-xl">Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary_email">Primary Email *</Label>
                    <Input
                      id="primary_email"
                      type="email"
                      {...register("primary_email")}
                    />
                    {errors.primary_email && (
                      <p className="text-sm text-destructive">
                        {errors.primary_email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondary_email">Secondary Email</Label>
                    <Input
                      id="secondary_email"
                      type="email"
                      {...register("secondary_email")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" {...register("phone")} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" {...register("address")} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle className="font-serif text-xl">
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Communication Preference</Label>
                    <Select
                      onValueChange={(value) =>
                        setValue("communication_preference", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select preference" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMUNICATION_PREFS.map((pref) => (
                          <SelectItem key={pref.value} value={pref.value}>
                            {pref.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sensitivities">Sensitivities</Label>
                    <Textarea
                      id="sensitivities"
                      {...register("sensitivities")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="special_instructions">
                      Special Instructions
                    </Label>
                    <Textarea
                      id="special_instructions"
                      {...register("special_instructions")}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Client"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/clients")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
