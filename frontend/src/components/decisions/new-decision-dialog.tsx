"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCreateDecision } from "@/hooks/use-decisions";
import { useClients } from "@/hooks/use-clients";
import type { DecisionCreateData, DecisionOption, DecisionResponseType } from "@/types/communication";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OptionDraft {
  id: string;
  label: string;
  description: string;
}

function generateOptionId(index: number) {
  return `option_${index + 1}`;
}

export function NewDecisionDialog({ open, onOpenChange }: NewDecisionDialogProps) {
  const createDecision = useCreateDecision();
  const { data: clientsData } = useClients({ limit: 200 });

  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [responseType, setResponseType] = useState<DecisionResponseType>("choice");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [consequenceText, setConsequenceText] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([
    { id: generateOptionId(0), label: "", description: "" },
    { id: generateOptionId(1), label: "", description: "" },
  ]);

  const needsOptions = responseType === "choice" || responseType === "multi_choice";

  const handleAddOption = () => {
    setOptions((prev) => [
      ...prev,
      { id: generateOptionId(prev.length), label: "", description: "" },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: keyof OptionDraft, value: string) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt))
    );
  };

  const handleResponseTypeChange = (value: DecisionResponseType) => {
    setResponseType(value);
    if (value === "choice" || value === "multi_choice") {
      if (options.length === 0) {
        setOptions([
          { id: generateOptionId(0), label: "", description: "" },
          { id: generateOptionId(1), label: "", description: "" },
        ]);
      }
    }
  };

  const resetForm = () => {
    setClientId("");
    setTitle("");
    setPrompt("");
    setResponseType("choice");
    setDeadlineDate("");
    setDeadlineTime("");
    setConsequenceText("");
    setOptions([
      { id: generateOptionId(0), label: "", description: "" },
      { id: generateOptionId(1), label: "", description: "" },
    ]);
  };

  const isValid = () => {
    if (!clientId || !title.trim() || !prompt.trim()) return false;
    if (needsOptions) {
      return options.length >= 2 && options.every((o) => o.label.trim().length > 0);
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!isValid()) return;

    const data: DecisionCreateData = {
      client_id: clientId,
      title: title.trim(),
      prompt: prompt.trim(),
      response_type: responseType,
      ...(deadlineDate && { deadline_date: deadlineDate }),
      ...(deadlineTime && { deadline_time: deadlineTime }),
      ...(consequenceText.trim() && { consequence_text: consequenceText.trim() }),
    };

    if (needsOptions) {
      data.options = options.map<DecisionOption>((opt) => ({
        id: opt.id,
        label: opt.label.trim(),
        description: opt.description.trim() || undefined,
      }));
    }

    try {
      await createDecision.mutateAsync(data);
      toast.success("Decision request created successfully");
      onOpenChange(false);
      resetForm();
    } catch {
      // error handled by mutation's onError toast
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const clients = clientsData?.clients ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Decision Request</DialogTitle>
          <DialogDescription>
            Create a decision request for a client to review and respond to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client */}
          <div className="space-y-1.5">
            <Label htmlFor="client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Approve Q2 Investment Allocation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <Label htmlFor="prompt">Decision Prompt *</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the decision the client needs to make..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
          </div>

          {/* Response Type */}
          <div className="space-y-1.5">
            <Label htmlFor="response-type">Response Type *</Label>
            <Select value={responseType} onValueChange={handleResponseTypeChange}>
              <SelectTrigger id="response-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="choice">Single Choice</SelectItem>
                <SelectItem value="multi_choice">Multiple Choice</SelectItem>
                <SelectItem value="yes_no">Yes / No</SelectItem>
                <SelectItem value="text">Free Text</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options (for choice/multi_choice) */}
          {needsOptions && (
            <div className="space-y-2">
              <Label>Options * (minimum 2)</Label>
              {options.map((opt, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    <Input
                      placeholder={`Option ${index + 1} label`}
                      value={opt.label}
                      onChange={(e) => handleOptionChange(index, "label", e.target.value)}
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={opt.description}
                      onChange={(e) => handleOptionChange(index, "description", e.target.value)}
                    />
                  </div>
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveOption(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="mt-1"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Option
              </Button>
            </div>
          )}

          {/* Deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deadline-date">Deadline Date</Label>
              <Input
                id="deadline-date"
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline-time">Deadline Time</Label>
              <Input
                id="deadline-time"
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                disabled={!deadlineDate}
              />
            </div>
          </div>

          {/* Consequence Text */}
          <div className="space-y-1.5">
            <Label htmlFor="consequence">Consequence Note</Label>
            <Textarea
              id="consequence"
              placeholder="Optional: note what happens if no decision is made by the deadline..."
              value={consequenceText}
              onChange={(e) => setConsequenceText(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid() || createDecision.isPending}
          >
            {createDecision.isPending ? "Creating..." : "Create Decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
