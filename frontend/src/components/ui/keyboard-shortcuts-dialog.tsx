"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  SHORTCUT_CATEGORIES,
  DEFAULT_SHORTCUTS,
  formatShortcutKeys,
  type KeyboardShortcut,
  type ShortcutCategory,
} from "@/lib/keyboard-shortcuts";
import { Kbd, SequentialShortcutDisplay } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts?: KeyboardShortcut[];
}

/**
 * Dialog component displaying all available keyboard shortcuts with search
 */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts = DEFAULT_SHORTCUTS,
}: KeyboardShortcutsDialogProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Focus search input when dialog opens
  React.useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery("");
    }
  }, [open]);

  // Filter shortcuts based on search query
  const filteredShortcuts = React.useMemo(() => {
    if (!searchQuery.trim()) return shortcuts;

    const query = searchQuery.toLowerCase();
    return shortcuts.filter(
      (shortcut) =>
        shortcut.label.toLowerCase().includes(query) ||
        shortcut.description?.toLowerCase().includes(query) ||
        shortcut.category.toLowerCase().includes(query) ||
        shortcut.keys?.some((key) => key.toLowerCase().includes(query)) ||
        shortcut.sequence?.firstKey.toLowerCase().includes(query) ||
        shortcut.sequence?.secondKey.toLowerCase().includes(query)
    );
  }, [shortcuts, searchQuery]);

  // Group filtered shortcuts by category
  const groupedShortcuts = React.useMemo(() => {
    const groups = new Map<ShortcutCategory, KeyboardShortcut[]>();

    filteredShortcuts.forEach((shortcut) => {
      const existing = groups.get(shortcut.category) ?? [];
      groups.set(shortcut.category, [...existing, shortcut]);
    });

    return groups;
  }, [filteredShortcuts]);

  const hasResults = filteredShortcuts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions quickly.
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[50vh] mt-4">
          <div className="px-6 pb-6 space-y-6">
            {hasResults ? (
              SHORTCUT_CATEGORIES.map((category) => {
                const categoryShortcuts = groupedShortcuts.get(category.id);
                if (!categoryShortcuts?.length) return null;

                return (
                  <div key={category.id}>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {category.label}
                    </h3>
                    <div className="space-y-2">
                      {categoryShortcuts.map((shortcut) => (
                        <ShortcutRow
                          key={shortcut.id}
                          shortcut={shortcut}
                          searchQuery={searchQuery}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No shortcuts found for "{searchQuery}"</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => setSearchQuery("")}
                >
                  Clear search
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="border-t p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Press <Kbd>?</Kbd> at any time to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Highlight matching text in a string
 */
function HighlightMatch({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}

/**
 * A single row displaying a keyboard shortcut
 */
function ShortcutRow({
  shortcut,
  searchQuery = "",
}: {
  shortcut: KeyboardShortcut;
  searchQuery?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex flex-col">
        <span className="text-sm">
          <HighlightMatch text={shortcut.label} query={searchQuery} />
        </span>
        {shortcut.description && (
          <span className="text-xs text-muted-foreground">
            <HighlightMatch text={shortcut.description} query={searchQuery} />
          </span>
        )}
      </div>
      {shortcut.sequence ? (
        <SequentialShortcutDisplay
          firstKey={shortcut.sequence.firstKey.toUpperCase()}
          secondKey={shortcut.sequence.secondKey.toUpperCase()}
        />
      ) : (
        <ShortcutKeysDisplay shortcut={shortcut} />
      )}
    </div>
  );
}

/**
 * Display the keys for a shortcut
 */
function ShortcutKeysDisplay({ shortcut }: { shortcut: KeyboardShortcut }) {
  const keys = formatShortcutKeys(shortcut);
  return (
    <div className="flex items-center gap-0.5">
      {keys.map((key, index) => (
        <React.Fragment key={`${key}-${index}`}>
          <Kbd>{key}</Kbd>
          {index < keys.length - 1 && (
            <span className="text-muted-foreground text-[10px] mx-0.5">+</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Context for the keyboard shortcuts dialog state
 */
const KeyboardShortcutsDialogContext = React.createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

/**
 * Provider for keyboard shortcuts dialog state
 */
export function KeyboardShortcutsDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const value = React.useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    [isOpen]
  );

  return (
    <KeyboardShortcutsDialogContext.Provider value={value}>
      {children}
      <KeyboardShortcutsDialog
        open={isOpen}
        onOpenChange={setIsOpen}
      />
    </KeyboardShortcutsDialogContext.Provider>
  );
}

/**
 * Hook to access keyboard shortcuts dialog state
 */
export function useKeyboardShortcutsDialog() {
  return React.useContext(KeyboardShortcutsDialogContext);
}
