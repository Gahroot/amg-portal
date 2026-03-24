"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Plus, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickTaskDialog } from "./quick-task-dialog";
import { detectQuickTaskContext } from "@/lib/quick-task-context";
import { isInputElement } from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";

interface QuickTaskButtonProps {
  /** Additional classes for the FAB wrapper */
  className?: string;
}

export function QuickTaskButton({ className }: QuickTaskButtonProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);

  const context = detectQuickTaskContext(pathname);

  const openDialog = useCallback(() => setOpen(true), []);

  // Keyboard shortcut: press "t" outside of inputs to open quick task
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "t" && e.key !== "T") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isInputElement(e.target)) return;
      if (open) return;
      e.preventDefault();
      openDialog();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, openDialog]);

  if (!visible) return null;

  return (
    <>
      <div
        className={cn(
          "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2",
          className,
        )}
      >
        {/* Hide button — tiny dismiss pill */}
        <button
          onClick={() => setVisible(false)}
          className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors px-1 select-none"
          aria-label="Hide quick task button"
        >
          hide
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/25 transition-all hover:scale-105 active:scale-95"
              onClick={openDialog}
              aria-label="New task (T)"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="flex items-center gap-2">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>New Task</span>
            <kbd className="ml-1 rounded border bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
              T
            </kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <QuickTaskDialog
        open={open}
        onOpenChange={setOpen}
        defaultProgramId={context.programId}
      />
    </>
  );
}
