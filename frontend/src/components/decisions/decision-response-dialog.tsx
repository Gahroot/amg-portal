"use client";

import { useState } from "react";
import type { DecisionRequest, DecisionResponseData } from "@/types/communication";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useRespondToDecision } from "@/hooks/use-decisions";

interface DecisionResponseDialogProps {
  decision: DecisionRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DecisionResponseDialog({ decision, open, onOpenChange }: DecisionResponseDialogProps) {
  const respond = useRespondToDecision();
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textResponse, setTextResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data: DecisionResponseData = {};

      if (decision.response_type === "choice" && selectedOption) {
        data.option_id = selectedOption;
      } else if (decision.response_type === "multi_choice") {
        // For multi-choice, we'd need a different data structure
        data.text = JSON.stringify(selectedOptions);
      } else if (decision.response_type === "text" || decision.response_type === "yes_no") {
        data.text = textResponse;
      }

      await respond.mutateAsync({ id: decision.id, data });
      onOpenChange(false);
      // Reset form
      setSelectedOption("");
      setSelectedOptions([]);
      setTextResponse("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderResponseInput = () => {
    switch (decision.response_type) {
      case "choice":
        return (
          <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
            {decision.options?.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem value={option.id} id={option.id} />
                <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "multi_choice":
        return (
          <div className="space-y-2">
            {decision.options?.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <Checkbox
                  id={option.id}
                  checked={selectedOptions.includes(option.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedOptions([...selectedOptions, option.id]);
                    } else {
                      setSelectedOptions(selectedOptions.filter((id) => id !== option.id));
                    }
                  }}
                />
                <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </div>
        );

      case "text":
        return (
          <Textarea
            placeholder="Enter your response..."
            value={textResponse}
            onChange={(e) => setTextResponse(e.target.value)}
            rows={4}
          />
        );

      case "yes_no":
        return (
          <RadioGroup value={textResponse} onValueChange={setTextResponse}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="yes" />
              <Label htmlFor="yes" className="cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="no" />
              <Label htmlFor="no" className="cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        );

      default:
        return null;
    }
  };

  const canSubmit = () => {
    switch (decision.response_type) {
      case "choice":
        return !!selectedOption;
      case "multi_choice":
        return selectedOptions.length > 0;
      case "text":
      case "yes_no":
        return textResponse.length > 0;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{decision.title}</DialogTitle>
          <DialogDescription>{decision.prompt}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {renderResponseInput()}
        </div>

        {decision.consequence_text && (
          <p className="text-sm text-muted-foreground">
            Note: {decision.consequence_text}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit() || isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
