"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

interface BriefSections {
  scope: string;
  deliverables: string;
  constraints: string;
  communication: string;
  acceptance: string;
}

interface AssignmentBriefBuilderProps {
  value: string;
  onChange: (compiled: string) => void;
  program: {
    scope?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    budget_envelope?: string | number | null;
    id?: string;
  } | null;
}

const SECTION_CONFIG = [
  { key: "scope" as const, label: "Scope", placeholder: "What this partner is responsible for", rows: 4 },
  { key: "deliverables" as const, label: "Deliverables", placeholder: "Expected deliverables, one per line", rows: 4 },
  { key: "constraints" as const, label: "Constraints", placeholder: "Timeline, budget ceiling, approval thresholds", rows: 3 },
  { key: "communication" as const, label: "Communication Protocol", placeholder: "How and when to reach the coordinator", rows: 3 },
  { key: "acceptance" as const, label: "Acceptance Criteria", placeholder: "What 'done' looks like for this assignment", rows: 3 },
];

function compileBrief(sections: BriefSections): string {
  return SECTION_CONFIG
    .filter(({ key }) => sections[key].trim())
    .map(({ key, label }) => `## ${label}\n${sections[key].trim()}`)
    .join("\n\n");
}

export function AssignmentBriefBuilder({
  value: _value,
  onChange,
  program,
}: AssignmentBriefBuilderProps) {
  const [sections, setSections] = useState<BriefSections>({
    scope: "",
    deliverables: "",
    constraints: "",
    communication: "",
    acceptance: "",
  });

  const prevProgramId = useRef<string | undefined>(undefined);

  // Auto-populate from program when program changes
  useEffect(() => {
    if (!program?.id || program.id === prevProgramId.current) return;
    prevProgramId.current = program.id;

    setSections((prev) => {
      const updated = { ...prev };
      if (!prev.scope && program.scope) {
        updated.scope = program.scope;
      }
      if (!prev.constraints) {
        const parts: string[] = [];
        if (program.start_date) parts.push(`Start: ${program.start_date}`);
        if (program.end_date) parts.push(`End: ${program.end_date}`);
        if (program.budget_envelope != null) {
          parts.push(`Budget ceiling: $${Number(program.budget_envelope).toLocaleString()}`);
        }
        if (parts.length > 0) updated.constraints = parts.join("\n");
      }
      return updated;
    });
  }, [program?.id, program?.scope, program?.start_date, program?.end_date, program?.budget_envelope]);

  // Sync compiled value upward (skip initial mount to avoid triggering validation on empty form)
  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    onChange(compileBrief(sections));
  // onChange is stable (setValue wrapper from RHF) — omitting it avoids a dep-array treadmill
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const updateSection = (key: keyof BriefSections, value: string) => {
    setSections((prev) => ({ ...prev, [key]: value }));
  };

  const clearSection = (key: keyof BriefSections) => {
    setSections((prev) => ({ ...prev, [key]: "" }));
  };

  return (
    <div className="space-y-3">
      {SECTION_CONFIG.map(({ key, label, placeholder, rows }) => (
        <Card key={key} className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
              </div>
              {sections[key] && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => clearSection(key)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={sections[key]}
              onChange={(e) => updateSection(key, e.target.value)}
              placeholder={placeholder}
              rows={rows}
            />
          </CardContent>
        </Card>
      ))}

      {compileBrief(sections) && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Preview</p>
            <pre className="rounded-md border bg-muted/50 p-3 text-xs whitespace-pre-wrap">
              {compileBrief(sections)}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
