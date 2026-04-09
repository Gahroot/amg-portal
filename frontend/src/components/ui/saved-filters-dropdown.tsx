"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SaveFilterDialog } from "@/components/ui/save-filter-dialog";
import {
  useSavedFilters,
  useCreateSavedFilter,
  useUpdateSavedFilter,
  useDeleteSavedFilter,
} from "@/hooks/use-saved-filters";
import type { SavedFilter } from "@/lib/api/saved-filters";
import { Filter, Star, Pencil, Trash2, Plus, Check } from "lucide-react";

interface SavedFiltersDropdownProps {
  entityType: string;
  currentFilters: Record<string, string>;
  onApplyFilter: (filterConfig: Record<string, string>) => void;
}

export function SavedFiltersDropdown({
  entityType,
  currentFilters,
  onApplyFilter,
}: SavedFiltersDropdownProps) {
  const { data } = useSavedFilters(entityType);
  const createMutation = useCreateSavedFilter();
  const updateMutation = useUpdateSavedFilter();
  const deleteMutation = useDeleteSavedFilter();

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<SavedFilter | null>(
    null
  );

  // Find which preset matches current filters (if any)
  const activePreset = useMemo(() => {
    const items = data?.items;
    if (!items) return null;
    return (
      items.find((item) => {
        const config = item.filter_config;
        const configKeys = Object.keys(config).filter(
          (k) => config[k] && config[k] !== "all"
        );
        const currentKeys = Object.keys(currentFilters).filter(
          (k) =>
            currentFilters[k] && currentFilters[k] !== "all" && currentFilters[k] !== ""
        );
        if (configKeys.length !== currentKeys.length) return false;
        return configKeys.every((k) => config[k] === currentFilters[k]);
      }) ?? null
    );
  }, [data, currentFilters]);

  function handleSave(name: string, isDefault: boolean) {
    // Only save non-empty, non-default filter values
    const cleanFilters: Record<string, string> = {};
    for (const [key, value] of Object.entries(currentFilters)) {
      if (value && value !== "all" && value !== "") {
        cleanFilters[key] = value;
      }
    }
    createMutation.mutate(
      {
        name,
        entity_type: entityType,
        filter_config: cleanFilters,
        is_default: isDefault,
      },
      { onSuccess: () => setSaveDialogOpen(false) }
    );
  }

  function handleEdit(name: string, isDefault: boolean) {
    if (!editingFilter) return;
    updateMutation.mutate(
      {
        id: editingFilter.id,
        data: { name, is_default: isDefault },
      },
      {
        onSuccess: () => setEditingFilter(null),
      }
    );
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  const presets = data?.items ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-4 w-4" />
            {activePreset ? activePreset.name : "Presets"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          {presets.length > 0 && (
            <>
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="flex items-center justify-between gap-2"
                >
                  <button
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() => onApplyFilter(preset.filter_config)}
                  >
                    {activePreset?.id === preset.id && (
                      <Check className="h-3 w-3 shrink-0" />
                    )}
                    {preset.is_default && activePreset?.id !== preset.id && (
                      <Star className="h-3 w-3 shrink-0 text-amber-500" />
                    )}
                    <span className="truncate">{preset.name}</span>
                  </button>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFilter(preset);
                      }}
                      className="rounded p-0.5 hover:bg-muted"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(preset.id);
                      }}
                      className="rounded p-0.5 hover:bg-muted"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Save current filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveFilterDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSave}
        isLoading={createMutation.isPending}
        mode="create"
      />

      <SaveFilterDialog
        open={!!editingFilter}
        onOpenChange={(open) => !open && setEditingFilter(null)}
        onSave={handleEdit}
        isLoading={updateMutation.isPending}
        initialName={editingFilter?.name ?? ""}
        initialIsDefault={editingFilter?.is_default ?? false}
        mode="edit"
      />
    </>
  );
}
