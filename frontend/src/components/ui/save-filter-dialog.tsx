"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, isDefault: boolean) => void;
  isLoading?: boolean;
  initialName?: string;
  initialIsDefault?: boolean;
  mode?: "create" | "edit";
}

export function SaveFilterDialog({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
  initialName = "",
  initialIsDefault = false,
  mode = "create",
}: SaveFilterDialogProps) {
  const [name, setName] = useState(initialName);
  const [isDefault, setIsDefault] = useState(initialIsDefault);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setIsDefault(initialIsDefault);
    }
  }, [open, initialName, initialIsDefault]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), isDefault);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Save Filter Preset" : "Edit Filter Preset"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filter-name">Preset Name</Label>
            <Input
              id="filter-name"
              placeholder="e.g. At-risk programs in EMEA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="filter-default"
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(checked === true)}
            />
            <Label htmlFor="filter-default" className="text-sm font-normal">
              Set as default filter for this view
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Saving..." : mode === "create" ? "Save" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
