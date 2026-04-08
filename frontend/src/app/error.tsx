"use client";

import { useEffect } from "react";
import { OctagonXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#FDFBF7] p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <OctagonXIcon className="h-5 w-5" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again
            {SUPPORT_EMAIL ? (
              <>
                {" "}or{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  email support
                </a>
                {" "}if the problem persists.
              </>
            ) : (
              " or contact support if the problem persists."
            )}
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset}>Try again</Button>
            {SUPPORT_EMAIL && (
              <Button variant="outline" asChild>
                <a href={`mailto:${SUPPORT_EMAIL}`}>Email Support</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
