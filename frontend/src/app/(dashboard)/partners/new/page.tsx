"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/auth-provider";
import { createPartner } from "@/lib/api/partners";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CAPABILITY_OPTIONS = [
  "Strategy",
  "Operations",
  "Technology",
  "Finance",
  "Legal",
  "HR",
  "Marketing",
  "Risk",
  "Compliance",
  "Tax",
];

const createPartnerSchema = z.object({
  firm_name: z.string().min(1, "Firm name is required"),
  contact_name: z.string().min(1, "Contact name is required"),
  contact_email: z.email("Please enter a valid email address"),
  contact_phone: z.string().optional(),
  geographies: z.string().optional(),
  notes: z.string().optional(),
});

type CreatePartnerFormData = z.infer<typeof createPartnerSchema>;

export default function NewPartnerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedCapabilities, setSelectedCapabilities] = React.useState<
    string[]
  >([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePartnerFormData>({
    resolver: zodResolver(createPartnerSchema),
  });

  if (
    user?.role !== "managing_director" &&
    user?.role !== "relationship_manager" &&
    user?.role !== "coordinator"
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const toggleCapability = (cap: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const onSubmit = async (data: CreatePartnerFormData) => {
    try {
      const geographies = data.geographies
        ? data.geographies
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean)
        : [];
      await createPartner({
        firm_name: data.firm_name,
        contact_name: data.contact_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone || undefined,
        capabilities: selectedCapabilities,
        geographies,
        notes: data.notes || undefined,
      });
      toast.success("Partner created successfully");
      router.push("/partners");
    } catch (err) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create partner. Please try again.";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-8">
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">
              Add New Partner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firm_name">Firm Name</Label>
                <Input id="firm_name" {...register("firm_name")} />
                {errors.firm_name && (
                  <p className="text-sm text-destructive">
                    {errors.firm_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input id="contact_name" {...register("contact_name")} />
                {errors.contact_name && (
                  <p className="text-sm text-destructive">
                    {errors.contact_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  {...register("contact_email")}
                />
                {errors.contact_email && (
                  <p className="text-sm text-destructive">
                    {errors.contact_email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_phone">
                  Contact Phone (optional)
                </Label>
                <Input id="contact_phone" {...register("contact_phone")} />
              </div>

              <div className="space-y-2">
                <Label>Capabilities</Label>
                <div className="flex flex-wrap gap-2">
                  {CAPABILITY_OPTIONS.map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => toggleCapability(cap)}
                      className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                        selectedCapabilities.includes(cap)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background hover:bg-accent"
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="geographies">
                  Geographies (comma-separated)
                </Label>
                <Input
                  id="geographies"
                  placeholder="e.g. US, UK, EU"
                  {...register("geographies")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" {...register("notes")} />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Partner"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/partners")}
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
