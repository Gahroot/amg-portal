"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedbackForm } from "./feedback-form";

interface FeedbackWidgetProps {
  className?: string;
}

export function FeedbackWidget({ className }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating feedback button */}
      <Button
        variant="default"
        size="lg"
        className={cn(
          "fixed bottom-20 right-6 z-40 h-14 w-14 rounded-full shadow-lg",
          "hover:scale-105 transition-transform",
          "bg-primary text-primary-foreground",
          className
        )}
        onClick={() => setIsOpen(true)}
        aria-label="Submit feedback"
      >
        <MessageSquarePlus className="h-6 w-6" />
      </Button>

      {/* Feedback dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve the portal by sharing your thoughts, reporting
              issues, or requesting features.
            </DialogDescription>
          </DialogHeader>
          <FeedbackForm
            onSuccess={() => setIsOpen(false)}
            onCancel={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
