"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkDeliverableUpload } from "@/components/partner/bulk-deliverable-upload";

export default function BulkDeliverableUploadPage() {
  const router = useRouter();

  function handleComplete({ succeeded }: { succeeded: number; failed: number }) {
    if (succeeded > 0) {
      // Navigate back to deliverables list after a short delay so the toast is visible
      setTimeout(() => router.push("/partner/deliverables"), 1500);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link href="/partner/deliverables">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Deliverables
            </Link>
          </Button>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Bulk Upload</h1>
          <p className="text-sm text-muted-foreground">
            Submit multiple deliverable files at once. Associate each file with an accepted
            assignment and add optional notes for the coordinator.
          </p>
        </div>
      </div>

      {/* Upload widget */}
      <BulkDeliverableUpload onComplete={handleComplete} />
    </div>
  );
}
