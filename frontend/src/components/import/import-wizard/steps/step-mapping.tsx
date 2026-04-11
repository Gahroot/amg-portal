"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ColumnMapping, ImportTemplate } from "@/types/import";

interface StepMappingProps {
  template: ImportTemplate | null;
  columns: string[];
  mappings: ColumnMapping[];
  isMapping: boolean;
  onMappingChange: (sourceColumn: string, targetField: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}

export function StepMapping({
  template,
  columns,
  mappings,
  isMapping,
  onMappingChange,
  onConfirm,
  onBack,
}: StepMappingProps) {
  const requiredFieldsMapped =
    template?.fields.every(
      (f) => f.required && mappings.some((m) => m.target_field === f.name),
    ) ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Map your columns</h2>
        <p className="text-muted-foreground">
          Match the columns from your file to the corresponding fields in the system.
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Your Column</TableHead>
              <TableHead className="w-1/3">Maps To</TableHead>
              <TableHead className="w-1/3">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columns.map((col) => {
              const mapping = mappings.find((m) => m.source_column === col);
              const fieldDef = template?.fields.find((f) => f.name === mapping?.target_field);

              return (
                <TableRow key={col}>
                  <TableCell className="font-medium">{col}</TableCell>
                  <TableCell>
                    <Select
                      value={mapping?.target_field || ""}
                      onValueChange={(value) => onMappingChange(col, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Skip this column --</SelectItem>
                        {template?.fields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.display_name}
                            {field.required && " *"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fieldDef?.description}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {template && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="font-medium">Required Fields Status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.fields
              .filter((f) => f.required)
              .map((field) => {
                const isMapped = mappings.some((m) => m.target_field === field.name);
                return (
                  <Badge key={field.name} variant={isMapped ? "default" : "destructive"}>
                    {isMapped ? (
                      <Check className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {field.display_name}
                  </Badge>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button disabled={isMapping || !requiredFieldsMapped} onClick={onConfirm}>
          {isMapping ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Validate Data
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
