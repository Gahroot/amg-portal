"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsBookmarked, useToggleBookmark } from "@/hooks/use-bookmarks";
import type { BookmarkEntityType } from "@/lib/api/bookmarks";

interface BookmarkButtonProps {
  entityType: BookmarkEntityType;
  entityId: string;
  entityTitle: string;
  entitySubtitle?: string | null;
  /** Size variant — "sm" renders a compact icon-only button */
  size?: "sm" | "default";
  className?: string;
}

export function BookmarkButton({
  entityType,
  entityId,
  entityTitle,
  entitySubtitle,
  size = "default",
  className,
}: BookmarkButtonProps) {
  const { isBookmarked, isLoading } = useIsBookmarked(entityType, entityId);
  const { toggle, isPending } = useToggleBookmark();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggle(isBookmarked, {
      entity_type: entityType,
      entity_id: entityId,
      entity_title: entityTitle,
      entity_subtitle: entitySubtitle,
    });
  }

  const label = isBookmarked ? "Remove pin" : "Pin to sidebar";

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              size === "sm" ? "h-7 w-7" : "h-9 w-9",
              "transition-colors",
              isBookmarked
                ? "text-amber-500 hover:text-amber-600 dark:text-amber-400"
                : "text-muted-foreground hover:text-foreground",
              className
            )}
            onClick={handleClick}
            disabled={isLoading || isPending}
            aria-label={label}
          >
            <Star
              className={cn(
                size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
                isBookmarked && "fill-current"
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
