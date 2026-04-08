"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/providers/auth-provider";
import { checkPartnerDuplicates } from "@/lib/api/partners";
import { useCreatePartner } from "@/hooks/use-partners";
import type { PartnerDuplicateMatch } from "@/types/partner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DuplicateWarningDialog,
  type PartnerDuplicateMatch as DialogPartnerMatch,
} from "@/components/common/duplicate-warning-dialog";

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
  const createPartnerMutation = useCreatePartner();
  const [selectedCapabilities, setSelectedCapabilities] = React.useState<
    string[]
  >([]);

  // Duplicate detection state
  const [duplicates, setDuplicates] = React.useState<PartnerDuplicateMatch[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = React.useState(false);
  const [pendingFormData, setPendingFormData] =
    React.useState<CreatePartnerFormData | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreatePartnerFormData>({
    resolver: zodResolver(createPartnerSchema),
  });

  // Watch individual form fields for duplicate detection — watching separately
  // gives stable primitive values so the dependency array doesn't change every render.
  const firmNameValue = watch("firm_name");
  const contactNameValue = watch("contact_name");
  const contactEmailValue = watch("contact_email");
  const contactPhoneValue = watch("contact_phone");

  // Debounced duplicate check
  React.useEffect(() => {
    // Only check if we have at least an email or firm name
    if (!contactEmailValue && !firmNameValue) {
      setDuplicates([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsCheckingDuplicates(true);
        const matches = await checkPartnerDuplicates({
          firm_name: firmNameValue || null,
          contact_name: contactNameValue || null,
          contact_email: contactEmailValue || null,
          contact_phone: contactPhoneValue || null,
        });
        setDuplicates(matches);
      } catch (error) {
        // Silently fail duplicate check - don't block form submission
        console.error("Failed to check duplicates:", error);
        setDuplicates([]);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [firmNameValue, contactNameValue, contactEmailValue, contactPhoneValue]);

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

  const doCreatePartner = async (data: CreatePartnerFormData) => {
    const geographies = data.geographies
      ? data.geographies
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : [];
    try {
      await createPartnerMutation.mutateAsync({
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
    } catch {
      // Error toast is handled by useCreatePartner's onError
    }
  };

  const onSubmit = async (data: CreatePartnerFormData) => {
    // If there are potential duplicates, show warning dialog
    if (duplicates.length > 0) {
      setPendingFormData(data);
      setShowDuplicateDialog(true);
      return;
    }

    // No duplicates, proceed with creation
    await doCreatePartner(data);
  };

  const handleCreateAnyway = async () => {
    if (!pendingFormData) return;
    await doCreatePartner(pendingFormData);
  };

  // Convert PartnerDuplicateMatch to DialogPartnerMatch format
  const dialogDuplicates: DialogPartnerMatch[] = duplicates.map((d) => ({
    partner_id: d.partner_id,
    firm_name: d.firm_name,
    contact_name: d.contact_name,
    contact_email: d.contact_email,
    contact_phone: d.contact_phone,
    similarity_score: d.similarity_score,
    match_reasons: d.match_reasons,
  }));

  return (
    <div className="min-h-screen bg-background p-8">
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
                <Button type="submit" disabled={isSubmitting || isCheckingDuplicates}>
                  {isSubmitting
                    ? "Creating..."
                    : isCheckingDuplicates
                      ? "Checking..."
                      : "Create Partner"}
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

      <DuplicateWarningDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        entityType="partner"
        duplicates={dialogDuplicates}
        onCreateAnyway={handleCreateAnyway}
      />
    </div>
  );
}
