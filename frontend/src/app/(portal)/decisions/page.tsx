"use client";

import { useState } from "react";
import {
  usePortalDecisions,
  useRespondToPortalDecision,
} from "@/hooks/use-clients";
import type { DecisionRequest, DecisionResponseData } from "@/types/communication";
import { DecisionRequestCard } from "@/components/decisions/decision-request-card";
import { DecisionDeadlineBadge } from "@/components/decisions/decision-deadline-badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PortalDecisionsPage() {
  const { data: pendingData, isLoading: pendingLoading } = usePortalDecisions({
    status: "pending",
  });
  const { data: allData, isLoading: allLoading } = usePortalDecisions();

  const [respondingTo, setRespondingTo] = useState<DecisionRequest | null>(null);
  const [viewingDetail, setViewingDetail] = useState<DecisionRequest | null>(
    null
  );

  const pendingDecisions = pendingData?.decisions ?? [];
  const allDecisions = allData?.decisions ?? [];
  const respondedDecisions = allDecisions.filter(
    (d) => d.status !== "pending"
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-serif text-3xl font-bold tracking-tight">
        Decision Requests
      </h1>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending{" "}
            {pendingDecisions.length > 0 && `(${pendingDecisions.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : pendingDecisions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No pending decisions at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingDecisions.map((decision) => (
                <DecisionRequestCard
                  key={decision.id}
                  decision={decision}
                  onResponse={() => setRespondingTo(decision)}
                  onViewDetails={() => setViewingDetail(decision)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          {allLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : respondedDecisions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No past decisions.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {respondedDecisions.map((decision) => (
                <DecisionRequestCard
                  key={decision.id}
                  decision={decision}
                  onViewDetails={() => setViewingDetail(decision)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Response Dialog */}
      {respondingTo && (
        <PortalDecisionResponseDialog
          decision={respondingTo}
          open={!!respondingTo}
          onOpenChange={(open) => {
            if (!open) setRespondingTo(null);
          }}
        />
      )}

      {/* Detail Dialog */}
      {viewingDetail && (
        <Dialog
          open={!!viewingDetail}
          onOpenChange={(open) => {
            if (!open) setViewingDetail(null);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{viewingDetail.title}</DialogTitle>
              <DialogDescription>{viewingDetail.prompt}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <DecisionDeadlineBadge decision={viewingDetail} />
              {viewingDetail.consequence_text && (
                <p className="text-sm text-muted-foreground">
                  If no response: {viewingDetail.consequence_text}
                </p>
              )}
              {viewingDetail.response && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Your Response
                  </p>
                  {viewingDetail.response.option_id && (
                    <p className="text-sm font-medium">
                      Option: {viewingDetail.response.option_id}
                    </p>
                  )}
                  {viewingDetail.response.text && (
                    <p className="text-sm">{viewingDetail.response.text}</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setViewingDetail(null)}
              >
                Close
              </Button>
              {viewingDetail.status === "pending" && (
                <Button
                  onClick={() => {
                    setViewingDetail(null);
                    setRespondingTo(viewingDetail);
                  }}
                >
                  Respond
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PortalDecisionResponseDialog({
  decision,
  open,
  onOpenChange,
}: {
  decision: DecisionRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const respond = useRespondToPortalDecision();
  const [selectedOption, setSelectedOption] = useState("");
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
        data.text = JSON.stringify(selectedOptions);
      } else if (
        decision.response_type === "text" ||
        decision.response_type === "yes_no"
      ) {
        data.text = textResponse;
      }

      await respond.mutateAsync({ id: decision.id, data });
      onOpenChange(false);
      setSelectedOption("");
      setSelectedOptions([]);
      setTextResponse("");
    } finally {
      setIsSubmitting(false);
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

  const renderResponseInput = () => {
    switch (decision.response_type) {
      case "choice":
        return (
          <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
            {decision.options?.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <RadioGroupItem value={option.id} id={`opt-${option.id}`} />
                <Label
                  htmlFor={`opt-${option.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div>
                    <p className="font-medium">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
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
                  id={`mc-${option.id}`}
                  checked={selectedOptions.includes(option.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedOptions([...selectedOptions, option.id]);
                    } else {
                      setSelectedOptions(
                        selectedOptions.filter((o) => o !== option.id)
                      );
                    }
                  }}
                />
                <Label
                  htmlFor={`mc-${option.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div>
                    <p className="font-medium">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
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
              <RadioGroupItem value="yes" id="portal-yes" />
              <Label htmlFor="portal-yes" className="cursor-pointer">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="portal-no" />
              <Label htmlFor="portal-no" className="cursor-pointer">
                No
              </Label>
            </div>
          </RadioGroup>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{decision.title}</DialogTitle>
          <DialogDescription>{decision.prompt}</DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderResponseInput()}</div>

        {decision.consequence_text && (
          <p className="text-sm text-muted-foreground">
            Note: {decision.consequence_text}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit() || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
