"use client";

import * as React from "react";
import { Plus, Pin, PinOff, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import {
  useQuickActions,
  QUICK_ACTION_CATEGORIES,
  type QuickAction,
  type QuickActionCategory,
} from "@/providers/quick-actions-provider";
import { cn } from "@/lib/utils";
import { isInputElement } from "@/lib/keyboard-shortcuts";

interface QuickActionsMenuProps {
  /** Use FAB (floating action button) style */
  fab?: boolean;
  /** Use toolbar button style */
  toolbar?: boolean;
  /** Additional class names */
  className?: string;
  /** Position for FAB */
  fabPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Whether to show pinned actions as separate buttons (FAB mode only) */
  showPinnedSeparately?: boolean;
  /** Whether to allow customization (pin/reorder) */
  allowCustomization?: boolean;
}

/**
 * Group actions by category
 */
function groupActionsByCategory(actions: QuickAction[]): Map<QuickActionCategory, QuickAction[]> {
  const groups = new Map<QuickActionCategory, QuickAction[]>();

  for (const action of actions) {
    const existing = groups.get(action.category) || [];
    existing.push(action);
    groups.set(action.category, existing);
  }

  // Sort groups by category order
  return new Map(
    Array.from(groups.entries()).sort(
      ([a], [b]) =>
        (QUICK_ACTION_CATEGORIES[a]?.order ?? 100) -
        (QUICK_ACTION_CATEGORIES[b]?.order ?? 100)
    )
  );
}

/**
 * Quick Actions Menu Component
 */
export function QuickActionsMenu({
  fab = true,
  toolbar = false,
  className,
  fabPosition = "bottom-right",
  showPinnedSeparately = true,
  allowCustomization = true,
}: QuickActionsMenuProps) {
  const {
    actions,
    pinnedActions,
    togglePin,
    executeAction,
    isOpen,
    openMenu,
    closeMenu,
    toggleMenu,
    isPinned,
  } = useQuickActions();

  const [customizeMode, setCustomizeMode] = React.useState(false);
  const [hoveredAction, setHoveredAction] = React.useState<string | null>(null);

  // Keyboard shortcut: press "a" outside of inputs to toggle quick actions
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "a" && e.key !== "A") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isInputElement(e.target)) return;
      e.preventDefault();
      toggleMenu();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleMenu]);

  // Handle action shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Check each action for a matching shortcut
      for (const action of actions) {
        if (!action.shortcut) continue;

        const matchesKey = e.key.toLowerCase() === action.shortcut.toLowerCase();
        const matchesMeta = action.shortcutMetaKey
          ? e.metaKey || e.ctrlKey
          : !e.metaKey && !e.ctrlKey;

        if (matchesKey && matchesMeta && !isInputElement(e.target)) {
          e.preventDefault();
          executeAction(action);
          return;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [actions, executeAction]);

  // Group actions by category
  const groupedActions = React.useMemo(
    () => groupActionsByCategory(actions),
    [actions]
  );

  // FAB position classes
  const fabPositionClasses: Record<string, string> = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "top-right": "top-20 right-6",
    "top-left": "top-20 left-6",
  };

  // Render action item
  const renderActionItem = (action: QuickAction) => {
    const Icon = action.icon;
    const pinned = isPinned(action.id);

    return (
      <DropdownMenuItem
        key={action.id}
        onClick={() => executeAction(action)}
        onMouseEnter={() => setHoveredAction(action.id)}
        onMouseLeave={() => setHoveredAction(null)}
        className="relative"
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{action.label}</span>
        {action.shortcut && (
          <DropdownMenuShortcut>
            {action.shortcutMetaKey && (
              <span className="mr-0.5">{navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}</span>
            )}
            <Kbd className="ml-auto">{action.shortcut.toUpperCase()}</Kbd>
          </DropdownMenuShortcut>
        )}
        {allowCustomization && hoveredAction === action.id && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePin(action.id);
            }}
            className="absolute right-8 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
            aria-label={pinned ? "Unpin action" : "Pin action"}
          >
            {pinned ? (
              <PinOff className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Pin className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        )}
      </DropdownMenuItem>
    );
  };

  // Render the dropdown content
  const renderDropdownContent = () => (
    <DropdownMenuContent
      align={fab ? "end" : "start"}
      side={fab ? "top" : "bottom"}
      sideOffset={8}
      className="w-64 max-h-[80vh] overflow-y-auto"
    >
      {/* Pinned section */}
      {pinnedActions.length > 0 && (
        <>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
            <Pin className="h-3 w-3" />
            Pinned
          </DropdownMenuLabel>
          {pinnedActions.map(renderActionItem)}
          <DropdownMenuSeparator />
        </>
      )}

      {/* Grouped actions */}
      {Array.from(groupedActions.entries()).map(([category, categoryActions]) => {
        // Filter out pinned actions from regular list
        const unpinnedActions = categoryActions.filter(
          (a) => !pinnedActions.some((p) => p.id === a.id)
        );
        if (unpinnedActions.length === 0) return null;

        return (
          <React.Fragment key={category}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {QUICK_ACTION_CATEGORIES[category]?.label || category}
            </DropdownMenuLabel>
            {unpinnedActions.map(renderActionItem)}
            <DropdownMenuSeparator />
          </React.Fragment>
        );
      })}

      {/* Customize option */}
      {allowCustomization && (
        <>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-xs">
              <Zap className="h-3 w-3 mr-2" />
              Customize Actions
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Pin/Unpin Actions
              </DropdownMenuLabel>
              {actions.map((action) => {
                const Icon = action.icon;
                const pinned = isPinned(action.id);
                return (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={() => togglePin(action.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{action.label}</span>
                    {pinned && <Pin className="h-3 w-3 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </>
      )}
    </DropdownMenuContent>
  );

  // Toolbar button style
  if (toolbar) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={(open) => open ? openMenu() : closeMenu()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMenu}
              className={cn("gap-1.5", className)}
              aria-label="Quick actions"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Actions</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Quick actions <Kbd className="ml-2">A</Kbd>
          </TooltipContent>
        </Tooltip>
        {renderDropdownContent()}
      </DropdownMenu>
    );
  }

  // FAB style
  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col items-end gap-2",
        fabPositionClasses[fabPosition],
        className
      )}
    >
      {/* Pinned action buttons (separate from dropdown) */}
      {showPinnedSeparately && pinnedActions.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {pinnedActions.slice(0, 3).map((action) => {
            const Icon = action.icon;
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 rounded-full shadow-md"
                    onClick={() => executeAction(action)}
                    aria-label={action.label}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {action.label}
                  {action.shortcut && (
                    <Kbd className="ml-2">{action.shortcut.toUpperCase()}</Kbd>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Main FAB with dropdown */}
      <DropdownMenu open={isOpen} onOpenChange={(open) => open ? openMenu() : closeMenu()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full shadow-lg shadow-black/20",
                "hover:shadow-xl hover:shadow-black/25 transition-all",
                "hover:scale-105 active:scale-95",
                isOpen && "rotate-45"
              )}
              onClick={toggleMenu}
              aria-label="Quick actions"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            <span>Quick Actions</span>
            <Kbd className="ml-1">A</Kbd>
          </TooltipContent>
        </Tooltip>
        {renderDropdownContent()}
      </DropdownMenu>
    </div>
  );
}

/**
 * Quick Actions Toolbar Button - for use in headers/toolbars
 */
export function QuickActionsToolbarButton(
  props: Omit<QuickActionsMenuProps, "toolbar" | "fab">
) {
  return <QuickActionsMenu {...props} toolbar fab={false} />;
}

/**
 * Quick Actions FAB - floating action button
 */
export function QuickActionsFAB(
  props: Omit<QuickActionsMenuProps, "toolbar" | "fab">
) {
  return <QuickActionsMenu {...props} fab toolbar={false} />;
}

export default QuickActionsMenu;
