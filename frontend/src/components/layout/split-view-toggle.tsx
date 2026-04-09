"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { useRouter } from "next/navigation";
import { Columns2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useSplitView,
  type SplitViewEntityType,
  type SplitViewPanel,
} from "@/hooks/use-split-view";
import { cn } from "@/lib/utils";

/**
 * Toggle button for split view in the header
 */
export function SplitViewToggle({ className }: { className?: string }) {
  const { isSplitView, exitSplitView, leftPanel: _leftPanel, rightPanel: _rightPanel } = useSplitView();

  if (!isSplitView) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 gap-1.5 text-xs", className)}
            onClick={exitSplitView}
          >
            <X className="h-3.5 w-3.5" />
            Exit Split
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Close split view and return to single panel
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Props for SplitViewContainer
 */
interface SplitViewContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Container that wraps children and shows split view when active
 */
export function SplitViewContainer({
  children,
  className,
}: SplitViewContainerProps) {
  const { isSplitView, leftPanel, rightPanel, splitRatio, syncScroll, setSplitRatio, closePanel, swapPanels, toggleSyncScroll } =
    useSplitView();

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  // Sync scroll between panels when enabled
  useEffect(() => {
    if (!syncScroll || !isSplitView) return;

    const leftEl = leftScrollRef.current;
    const rightEl = rightScrollRef.current;
    if (!leftEl || !rightEl) return;

    let isLeftScrolling = false;
    let isRightScrolling = false;

    const syncLeftToRight = () => {
      if (isRightScrolling) return;
      isLeftScrolling = true;
      const scrollRatio =
        leftEl.scrollTop / (leftEl.scrollHeight - leftEl.clientHeight);
      rightEl.scrollTop =
        scrollRatio * (rightEl.scrollHeight - rightEl.clientHeight);
      requestAnimationFrame(() => {
        isLeftScrolling = false;
      });
    };

    const syncRightToLeft = () => {
      if (isLeftScrolling) return;
      isRightScrolling = true;
      const scrollRatio =
        rightEl.scrollTop / (rightEl.scrollHeight - rightEl.clientHeight);
      leftEl.scrollTop =
        scrollRatio * (leftEl.scrollHeight - leftEl.clientHeight);
      requestAnimationFrame(() => {
        isRightScrolling = false;
      });
    };

    leftEl.addEventListener("scroll", syncLeftToRight);
    rightEl.addEventListener("scroll", syncRightToLeft);

    return () => {
      leftEl.removeEventListener("scroll", syncLeftToRight);
      rightEl.removeEventListener("scroll", syncRightToLeft);
    };
  }, [syncScroll, isSplitView]);

  // If not in split view, just render children
  if (!isSplitView) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("flex h-full flex-col overflow-hidden", className)}>
      {/* Split View Toolbar */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Columns2 className="h-3.5 w-3.5" />
          <span>Split View</span>
          <span className="text-muted-foreground/50">|</span>
          <span>
            {Math.round(splitRatio * 100)}% / {Math.round((1 - splitRatio) * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={toggleSyncScroll}
                >
                  {syncScroll ? "Unsync Scroll" : "Sync Scroll"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {syncScroll
                  ? "Disable synchronized scrolling"
                  : "Enable synchronized scrolling"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={swapPanels}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Swap panels</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Split Panels Container */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className="flex flex-col overflow-hidden border-r"
          style={{ width: `${splitRatio * 100}%` }}
        >
          <SplitPanel
            panel={leftPanel}
            side="left"
            scrollRef={leftScrollRef}
            syncScroll={syncScroll}
            onClose={() => closePanel("left")}
          />
        </div>

        {/* Resize Handle */}
        <ResizeHandle splitRatio={splitRatio} onDrag={setSplitRatio} />

        {/* Right Panel */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${(1 - splitRatio) * 100}%` }}
        >
          <SplitPanel
            panel={rightPanel}
            side="right"
            scrollRef={rightScrollRef}
            syncScroll={syncScroll}
            onClose={() => closePanel("right")}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Individual panel in split view
 */
function SplitPanel({
  panel,
  side: _side,
  scrollRef,
  syncScroll,
  onClose,
}: {
  panel: SplitViewPanel | null;
  side: "left" | "right";
  scrollRef: RefObject<HTMLDivElement | null>;
  syncScroll: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!panel) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <Columns2 className="mx-auto h-12 w-12 opacity-50" />
          <p className="mt-2 text-sm">No content selected</p>
          <p className="text-xs">Select an item to view in split mode</p>
        </div>
      </div>
    );
  }

  const entityLabel = getEntityLabel(panel.entityType);
  const entityPath = getEntityPath(panel.entityType, panel.entityId);

  const handleOpenFull = () => {
    if (router) {
      router.push(entityPath);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {entityLabel}
          </span>
          {panel.title && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="truncate text-sm font-medium">{panel.title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleOpenFull}
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open in full page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close panel</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {/* Panel Content via iframe */}
      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-auto", syncScroll && "scroll-smooth")}
      >
        <iframe
          src={entityPath}
          className="h-full w-full border-0"
          title={`${entityLabel} - ${panel.title || panel.entityId}`}
        />
      </div>
    </div>
  );
}

/**
 * Draggable resize handle between panels
 */
function ResizeHandle({
  onDrag,
  splitRatio,
}: {
  onDrag: (ratio: number) => void;
  splitRatio: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const container = containerRef.current.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const newRatio = (e.clientX - rect.left) / rect.width;
      const clampedRatio = Math.max(0.2, Math.min(0.8, newRatio));
      onDrag(clampedRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = isDragging ? "col-resize" : "";
    document.body.style.userSelect = isDragging ? "none" : "";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, onDrag]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative z-10 flex w-1.5 cursor-col-resize items-center justify-center transition-colors",
        "hover:bg-primary/20",
        isDragging && "bg-primary/30"
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      aria-valuenow={Math.round(splitRatio * 100)}
    >
      <div className="flex h-8 w-1 items-center justify-center rounded-full bg-border">
        <svg
          className="h-4 w-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Utility function to get entity path based on type
 */
function getEntityPath(entityType: SplitViewEntityType, entityId: string): string {
  const paths: Record<SplitViewEntityType, string> = {
    client: `/clients/${entityId}`,
    program: `/programs/${entityId}`,
    partner: `/partners/${entityId}`,
    task: `/tasks?task=${entityId}`,
    message: `/communications?message=${entityId}`,
    deliverable: `/deliverables/${entityId}`,
  };
  return paths[entityType];
}

/**
 * Utility function to get entity label based on type
 */
function getEntityLabel(entityType: SplitViewEntityType): string {
  const labels: Record<SplitViewEntityType, string> = {
    client: "Client",
    program: "Program",
    partner: "Partner",
    task: "Task",
    message: "Message",
    deliverable: "Deliverable",
  };
  return labels[entityType];
}

export default SplitViewContainer;
