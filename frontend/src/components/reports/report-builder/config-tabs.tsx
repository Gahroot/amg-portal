import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  FieldMeta,
  FilterOperator,
  ReportFilter,
  ReportSort,
  SortDirection,
} from "@/types/custom-report";
import { FILTER_OPERATORS } from "./constants";

interface ConfigTabsProps {
  activeTab: string;
  onActiveTabChange: (v: string) => void;
  availableFields: FieldMeta[] | undefined;
  filters: ReportFilter[];
  onAddFilter: () => void;
  onUpdateFilter: (i: number, patch: Partial<ReportFilter>) => void;
  onRemoveFilter: (i: number) => void;
  sorting: ReportSort[];
  onAddSort: () => void;
  onUpdateSort: (i: number, patch: Partial<ReportSort>) => void;
  onRemoveSort: (i: number) => void;
  grouping: string[];
  onUpdateGroup: (i: number, key: string) => void;
  onRemoveGroup: (i: number) => void;
  onAddGroup: () => void;
}

export function ConfigTabs({
  activeTab,
  onActiveTabChange,
  availableFields,
  filters,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  sorting,
  onAddSort,
  onUpdateSort,
  onRemoveSort,
  grouping,
  onUpdateGroup,
  onRemoveGroup,
  onAddGroup,
}: ConfigTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onActiveTabChange}>
      <TabsList className="grid w-full grid-cols-3 text-xs">
        <TabsTrigger value="filters">
          Filters
          {filters.length > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {filters.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="sort">
          Sort
          {sorting.length > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {sorting.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="group">Group</TabsTrigger>
      </TabsList>

      <TabsContent value="filters" className="mt-2 space-y-2">
        {filters.map((filter, i) => (
          <div key={i} className="rounded-md border p-2 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Filter {i + 1}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Select
              value={filter.field}
              onValueChange={(v) => onUpdateFilter(i, { field: v })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Field" />
              </SelectTrigger>
              <SelectContent>
                {availableFields?.map((f) => (
                  <SelectItem key={f.key} value={f.key} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.operator}
              onValueChange={(v) =>
                onUpdateFilter(i, { operator: v as FilterOperator })
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Operator" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filter.operator !== "is_null" && filter.operator !== "is_not_null" && (
              <Input
                className="h-7 text-xs"
                placeholder="Value"
                value={String(filter.value ?? "")}
                onChange={(e) => onUpdateFilter(i, { value: e.target.value })}
              />
            )}
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onAddFilter}
          disabled={!availableFields?.length}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add filter
        </Button>
      </TabsContent>

      <TabsContent value="sort" className="mt-2 space-y-2">
        {sorting.map((sort, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Select
              value={sort.field}
              onValueChange={(v) => onUpdateSort(i, { field: v })}
            >
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableFields?.map((f) => (
                  <SelectItem key={f.key} value={f.key} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sort.direction}
              onValueChange={(v) =>
                onUpdateSort(i, { direction: v as SortDirection })
              }
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc" className="text-xs">
                  Asc
                </SelectItem>
                <SelectItem value="desc" className="text-xs">
                  Desc
                </SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => onRemoveSort(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onAddSort}
          disabled={!availableFields?.length}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add sort
        </Button>
      </TabsContent>

      <TabsContent value="group" className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          Group results by one or more fields.
        </p>
        {grouping.map((key, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Select value={key} onValueChange={(v) => onUpdateGroup(i, v)}>
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableFields?.map((f) => (
                  <SelectItem key={f.key} value={f.key} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => onRemoveGroup(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onAddGroup}
          disabled={!availableFields?.length}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add grouping
        </Button>
      </TabsContent>
    </Tabs>
  );
}
