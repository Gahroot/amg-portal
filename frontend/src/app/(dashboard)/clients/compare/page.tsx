"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useClientComparison } from "@/hooks/use-comparison";
import { ClientComparison } from "@/components/clients/client-comparison";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

function ClientCompareContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") ?? "";
  const ids = useMemo(
    () => idsParam.split(",").filter(Boolean),
    [idsParam]
  );

  const { data: clients, isLoading, error } = useClientComparison(ids);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (ids.length < 2 || ids.length > 4) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">
              Please select 2 to 4 clients to compare.
            </p>
            <Button asChild variant="outline">
              <Link href="/clients">Back to Clients</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/clients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Clients
              </Link>
            </Button>
            <h1 className="font-serif text-2xl font-bold tracking-tight">
              Compare Clients
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Export / Print
          </Button>
        </div>

        {isLoading ? (
          <TableSkeleton rows={8} columns={ids.length + 1} />
        ) : error ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <p className="text-destructive">
              Failed to load comparison data. Please try again.
            </p>
          </div>
        ) : clients ? (
          <ClientComparison clients={clients} />
        ) : null}
      </div>
    </div>
  );
}

export default function ClientComparePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <TableSkeleton rows={8} columns={3} />
          </div>
        </div>
      }
    >
      <ClientCompareContent />
    </Suspense>
  );
}
