"use client";

import { ArrowRight, CheckCircle2, Download, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTemplateDownloadUrl } from "@/lib/api/imports";
import {
  type ImportEntityType,
  type ImportTemplate,
  ENTITY_TYPE_DESCRIPTIONS,
  ENTITY_TYPE_LABELS,
} from "@/types/import";

interface StepSelectProps {
  entityType: ImportEntityType | null;
  template: ImportTemplate | null;
  isLoadingTemplate: boolean;
  onSelect: (type: ImportEntityType) => void;
  onContinue: () => void;
}

export function StepSelect({
  entityType,
  template,
  isLoadingTemplate,
  onSelect,
  onContinue,
}: StepSelectProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What would you like to import?</h2>
        <p className="text-muted-foreground">
          Select the type of data you want to import into the system.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(ENTITY_TYPE_LABELS) as ImportEntityType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={cn(
              "flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all hover:border-primary/50",
              entityType === type ? "border-primary bg-primary/5" : "border-muted",
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-semibold">{ENTITY_TYPE_LABELS[type]}</span>
              {entityType === type && <CheckCircle2 className="h-5 w-5 text-primary" />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {ENTITY_TYPE_DESCRIPTIONS[type]}
            </p>
          </button>
        ))}
      </div>

      {template && entityType && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Required Fields</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {template.fields
                  .filter((f) => f.required)
                  .map((f) => f.display_name)
                  .join(", ")}
              </p>
              <Button
                variant="link"
                className="mt-2 h-auto p-0"
                onClick={() => window.open(getTemplateDownloadUrl(entityType), "_blank")}
              >
                <Download className="mr-1 h-4 w-4" />
                Download template CSV
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button disabled={!entityType || isLoadingTemplate} onClick={onContinue}>
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
