"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getFeedbackTypes,
  submitFeedback,
  type FeedbackTypeOption,
  type FeedbackCreateData,
} from "@/lib/api/feedback";

interface FeedbackFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialType?: string;
}

export function FeedbackForm({
  onSuccess,
  onCancel,
  initialType,
}: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = React.useState(initialType || "");
  const [description, setDescription] = React.useState("");

  // Fetch available feedback types
  const { data: typesData } = useQuery({
    queryKey: ["feedback-types"],
    queryFn: getFeedbackTypes,
  });

  const feedbackTypes = typesData?.types || [];

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: FeedbackCreateData) => submitFeedback(data),
    onSuccess: () => {
      toast.success("Feedback submitted", {
        description: "Thank you for your feedback! We'll review it shortly.",
      });
      setFeedbackType("");
      setDescription("");
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("Failed to submit feedback", {
        description: error.message || "Please try again later.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackType) {
      toast.error("Please select a feedback type");
      return;
    }

    if (description.trim().length < 10) {
      toast.error("Description too short", {
        description: "Please provide at least 10 characters.",
      });
      return;
    }

    submitMutation.mutate({
      feedback_type: feedbackType,
      description: description.trim(),
      page_url: typeof window !== "undefined" ? window.location.href : undefined,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  };

  const isLoading = submitMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Feedback type selector */}
      <div className="space-y-2">
        <Label htmlFor="feedback-type">Type of feedback</Label>
        <Select value={feedbackType} onValueChange={setFeedbackType}>
          <SelectTrigger id="feedback-type" className="w-full">
            <SelectValue placeholder="Select feedback type..." />
          </SelectTrigger>
          <SelectContent>
            {feedbackTypes.map((type: FeedbackTypeOption) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{type.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {feedbackType && (
          <p className="text-xs text-muted-foreground">
            {feedbackTypes.find((t) => t.value === feedbackType)?.description}
          </p>
        )}
      </div>

      {/* Description textarea */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your feedback in detail..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="resize-none"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          {description.length}/10000 characters (minimum 10)
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading || description.length < 10}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Submit Feedback
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
