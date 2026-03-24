"use client";

import * as React from "react";
import {
  Zap,
  Pin,
  ChevronUp,
  ChevronDown,
  Settings,
  MoreHorizontal,
  Search,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import {
  useQuickActions,
  type QuickAction,
} from "@/providers/quick-actions-provider";
import {
  useQuickActionsBar,
  getBarPositionClasses,
  type QuickActionsBarPosition,
  type QuickActionsBarMode,
} from "@/hooks/use-quick-actions-bar";
import { cn } from "@/lib/utils";

interface QuickActionsBarProps {
  /** Position of the bar */
  position?: QuickActionsBarPosition;
  /** Display mode */
  mode?: QuickActionsBarMode;
  /** Maximum actions to display */
  maxActions?: number;
  /** Whether to show labels */
  showLabels?: boolean;
  /** Whether to show keyboard shortcuts */
  showShortcuts?: boolean;
  /** Whether to allow customization */
  allowCustomization?: boolean;
  /** Whether the bar is initially collapsed */
  defaultCollapsed?: boolean;
  /** Additional class names */
  className?: string;
  /** Callback when an action is executed */
  onActionExecute?: (action: QuickAction) => void;
}

// Common actions always available
const COMMON_ACTIONS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: string;
}> = [
  {
    id: "search",
    label: "Search",
    icon: Search,
    shortcut: "/",
    action: "focus-search",
  },
  {
    id: "command-palette",
    label: "Commands",
    icon: Zap,
    shortcut: "⌘K",
    action: "command-palette",
  },
  {
    id: "help",
    label: "Help",
    icon: HelpCircle,
    shortcut: "?",
    action: "help",
  },
];

/**
 * Quick Actions Bar - A keyboard-accessible floating action bar
 * 
 * Provides quick access to common actions with full keyboard navigation:
 * - Press ' (single quote) to focus the bar
 * - Tab or Arrow keys to navigate between actions
 * - Enter/Space to activate
 * - Escape to dismiss
 */
export function QuickActionsBar({
  position = "bottom-center",
  mode = "auto",
  maxActions = 6,
  showLabels = true,
  showShortcuts = true,
  allowCustomization = true,
  defaultCollapsed = false,
  className,
  onActionExecute,
}: QuickActionsBarProps) {
  const {
    actions: contextActions,
    pinnedActions,
    togglePin,
    executeAction,
    isPinned,
  } = useQuickActions();

  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [visibleCount, setVisibleCount] = React.useState(maxActions);

  // Combine pinned actions with context actions
  const allActions = React.useMemo(() => {
    // Start with pinned actions
    const pinned = pinnedActions.slice(0, 3);
    
    // Add context actions that aren't already pinned
    const unpinnedContext = contextActions.filter(
      (a) => !pinned.some((p) => p.id === a.id)
    );
    
    return [...pinned, ...unpinnedContext];
  }, [pinnedActions, contextActions]);

  // Actions to display
  const displayedActions = React.useMemo(() => {
    return allActions.slice(0, visibleCount);
  }, [allActions, visibleCount]);

  // Handle action activation
  const handleActivateAction = React.useCallback(
    (index: number) => {
      const action = displayedActions[index];
      if (action) {
        executeAction(action);
        onActionExecute?.(action);
      }
    },
    [displayedActions, executeAction, onActionExecute]
  );

  // Use the hook for keyboard navigation
  const {
    state: barState,
    barRef,
    showBar,
    hideBar,
    handleKeyDown,
  } = useQuickActionsBar(displayedActions.length, handleActivateAction, {
    position,
    mode,
    maxActions,
    showLabels,
    showShortcuts,
    allowCustomization,
  });

  // Handle common action click
  const handleCommonAction = React.useCallback(
    (actionId: string) => {
      switch (actionId) {
        case "search":
          window.dispatchEvent(new CustomEvent("quick-actions:focus-search"));
          break;
        case "command-palette":
          window.dispatchEvent(new CustomEvent("quick-actions:command-palette"));
          break;
        case "help":
          window.dispatchEvent(new CustomEvent("quick-actions:help"));
          break;
      }
    },
    []
  );

  // Show more actions
  const showMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + maxActions, allActions.length));
  }, [maxActions, allActions.length]);

  // Show fewer actions
  const showFewer = React.useCallback(() => {
    setVisibleCount(maxActions);
  }, [maxActions]);

  // Toggle collapsed state
  const toggleCollapsed = React.useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  // Position classes
  const positionClasses = getBarPositionClasses(position);

  // Don't render if not visible and not in focus-only mode
  if (!barState.isVisible && mode === "focus-only" && !barState.isFocused) {
    return null;
  }

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Quick actions bar"
      tabIndex={0}
      data-tour="quick-actions-bar"
      onKeyDown={handleKeyDown}
      onFocus={showBar}
      onMouseEnter={showBar}
      onMouseLeave={mode === "auto" ? hideBar : undefined}
      className={cn(
        "fixed z-50 flex items-center gap-1",
        "rounded-full border bg-background/95 backdrop-blur-sm shadow-lg",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Hide when collapsed (only show trigger)
        isCollapsed ? "p-1" : "px-2 py-1.5",
        // Visibility animation
        !barState.isVisible && mode !== "always" && "opacity-0 pointer-events-none",
        positionClasses,
        className
      )}
    >
      {/* Collapse toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full shrink-0",
              isCollapsed && "bg-primary text-primary-foreground"
            )}
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand quick actions bar" : "Collapse quick actions bar"}
          >
            {isCollapsed ? (
              <Zap className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {isCollapsed ? "Expand" : "Collapse"}
          <Kbd className="ml-1">&apos;</Kbd>
        </TooltipContent>
      </Tooltip>

      {/* Actions (hidden when collapsed) */}
      {!isCollapsed && (
        <>
          {/* Divider */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Pinned/Context Actions */}
          <div className="flex items-center gap-0.5" role="group" aria-label="Context actions">
            {displayedActions.map((action, index) => {
              const Icon = action.icon;
              const isActionFocused = barState.focusedIndex === index;
              const pinned = isPinned(action.id);

              return (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActionFocused ? "default" : "ghost"}
                      size={showLabels ? "sm" : "icon"}
                      className={cn(
                        "h-8 gap-1.5 rounded-full",
                        !showLabels && "w-8 px-0",
                        pinned && "border border-primary/30",
                        isActionFocused && "ring-2 ring-ring"
                      )}
                      onClick={() => {
                        executeAction(action);
                        onActionExecute?.(action);
                      }}
                      onFocus={() => {}}
                      aria-label={action.label}
                      tabIndex={isActionFocused ? 0 : -1}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {showLabels && (
                        <span className="text-xs font-medium">{action.label}</span>
                      )}
                      {pinned && !showLabels && (
                        <Pin className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-primary" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="flex items-center gap-2">
                    <span>{action.label}</span>
                    {showShortcuts && action.shortcut && (
                      <Kbd className="ml-1">{action.shortcut.toUpperCase()}</Kbd>
                    )}
                    {pinned && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        Pinned
                      </Badge>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Show more/fewer */}
          {allActions.length > visibleCount && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0"
                  onClick={showMore}
                  aria-label={`Show ${allActions.length - visibleCount} more actions`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                +{allActions.length - visibleCount} more
              </TooltipContent>
            </Tooltip>
          )}

          {visibleCount > maxActions && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0"
                  onClick={showFewer}
                  aria-label="Show fewer actions"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Show fewer</TooltipContent>
            </Tooltip>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-border mx-1" />

          {/* Common actions */}
          <div className="flex items-center gap-0.5" role="group" aria-label="Common actions">
            {COMMON_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Tooltip key={action.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCommonAction(action.id)}
                      aria-label={action.label}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="flex items-center gap-2">
                    <span>{action.label}</span>
                    {showShortcuts && action.shortcut && (
                      <Kbd className="ml-1">{action.shortcut}</Kbd>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Customize menu */}
          {allowCustomization && (
            <>
              <div className="w-px h-6 bg-border mx-1" />
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Customize actions"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Customize</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Pin/Unpin Actions
                  </DropdownMenuLabel>
                  {allActions.map((action) => {
                    const Icon = action.icon;
                    const pinned = isPinned(action.id);
                    return (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={() => togglePin(action.id)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        <span className="flex-1 truncate">{action.label}</span>
                        {pinned && <Pin className="h-3 w-3 text-primary ml-2" />}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Display Options
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setIsCollapsed(true)}>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Collapse Bar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Mini version of the quick actions bar - only icons, no labels
 */
export function QuickActionsBarMini(
  props: Omit<QuickActionsBarProps, "showLabels">
) {
  return <QuickActionsBar {...props} showLabels={false} />;
}

/**
 * Quick Actions Bar Trigger - A button to show/hide the bar
 */
export function QuickActionsBarTrigger({
  onClick,
  isExpanded,
  className,
}: {
  onClick: () => void;
  isExpanded?: boolean;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={onClick}
          className={cn("gap-1.5", className)}
          aria-label={isExpanded ? "Hide quick actions bar" : "Show quick actions bar"}
          aria-expanded={isExpanded}
        >
          <Zap className="h-4 w-4" />
          <span className="hidden sm:inline">Quick Actions</span>
          <Kbd className="ml-1 hidden sm:inline">&apos;</Kbd>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Quick Actions <Kbd className="ml-1">&apos;</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

export default QuickActionsBar;
