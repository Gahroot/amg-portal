"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateDocumentRequest } from "@/hooks/use-document-requests";
import type { DocumentRequestType } from "@/types/document";

const DOCUMENT_TYPES: { value: DocumentRequestType; label: string; template: string }[] = [
  {
    value: "passport",
    label: "Passport",
    template:
      "Please provide a clear copy of your valid passport (all pages including the photo page). Ensure the document is not expired.",
  },
  {
    value: "national_id",
    label: "National ID",
    template:
      "Please upload a clear copy of your national identity card (front and back). The document must be current and not expired.",
  },
  {
    value: "proof_of_address",
    label: "Proof of Address",
    template:
      "Please provide a recent proof of address (e.g. utility bill, bank statement, or official correspondence) dated within the last 3 months.",
  },
  {
    value: "bank_statement",
    label: "Bank Statement",
    template:
      "Please upload your most recent bank statement (covering at least the last 3 months). All account numbers and personal details must be clearly visible.",
  },
  {
    value: "tax_return",
    label: "Tax Return",
    template:
      "Please provide a copy of your most recent filed tax return, including all supporting schedules. Ensure the document is signed and dated.",
  },
  {
    value: "source_of_wealth",
    label: "Source of Wealth",
    template:
      "As part of our compliance process, please provide documentation evidencing your source of wealth (e.g. business ownership documents, investment statements, or inheritance records).",
  },
  {
    value: "financial_statement",
    label: "Financial Statement",
    template:
      "Please provide your most recent audited or unaudited financial statements. These should cover at least the last 12 months.",
  },
  {
    value: "corporate_documents",
    label: "Corporate Documents",
    template:
      "Please provide the relevant corporate documentation, including certificate of incorporation, memorandum and articles of association, and register of directors.",
  },
  {
    value: "contract",
    label: "Contract",
    template:
      "Please upload the executed contract or agreement. Ensure all pages are signed and initialled where required.",
  },
  {
    value: "signed_agreement",
    label: "Signed Agreement",
    template:
      "Please return the signed agreement at your earliest convenience. All signatories must have signed and dated the document.",
  },
  {
    value: "insurance_certificate",
    label: "Insurance Certificate",
    template:
      "Please provide a current insurance certificate showing coverage details, policy number, and validity period.",
  },
  {
    value: "other",
    label: "Other",
    template: "",
  },
];

interface RequestDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName?: string;
}

export function RequestDocumentDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
}: RequestDocumentDialogProps) {
  const createRequest = useCreateDocumentRequest();

  const [documentType, setDocumentType] = useState<DocumentRequestType>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [deadline, setDeadline] = useState("");

  function handleTypeChange(type: DocumentRequestType) {
    setDocumentType(type);
    const template = DOCUMENT_TYPES.find((t) => t.value === type);
    if (template) {
      if (!title) setTitle(template.label);
      if (template.template && !message) setMessage(template.template);
    }
  }

  function handleSubmit() {
    if (!title.trim()) return;
    createRequest.mutate(
      {
        client_id: clientId,
        document_type: documentType,
        title: title.trim(),
        description: description.trim() || undefined,
        message: message.trim() || undefined,
        deadline: deadline || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      },
    );
  }

  function resetForm() {
    setDocumentType("other");
    setTitle("");
    setDescription("");
    setMessage("");
    setDeadline("");
  }

  function handleOpenChange(open: boolean) {
    if (!open) resetForm();
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Document{clientName ? ` from ${clientName}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Document Type */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Document Type</Label>
            <Select
              value={documentType}
              onValueChange={(v) => handleTypeChange(v as DocumentRequestType)}
            >
              <SelectTrigger id="doc-type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="req-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="req-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 2025 Bank Statement"
            />
          </div>

          {/* Description (internal notes) */}
          <div className="space-y-1.5">
            <Label htmlFor="req-description">Internal Notes</Label>
            <Input
              id="req-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional internal notes (not shown to client)"
            />
          </div>

          {/* Message to client */}
          <div className="space-y-1.5">
            <Label htmlFor="req-message">Message to Client</Label>
            <Textarea
              id="req-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Instructions shown to the client in the portal"
              rows={4}
            />
          </div>

          {/* Deadline */}
          <div className="space-y-1.5">
            <Label htmlFor="req-deadline" className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              Deadline (optional)
            </Label>
            <Input
              id="req-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || createRequest.isPending}
          >
            {createRequest.isPending ? "Sending…" : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
