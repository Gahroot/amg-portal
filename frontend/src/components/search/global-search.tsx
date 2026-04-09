"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchSuggestions } from "@/components/search/search-suggestions";
import { useSearchSuggestions } from "@/hooks/use-search-suggestions";
import { useAddRecentSearch } from "@/hooks/use-recent-searches";
import type { SearchSuggestion } from "@/lib/api/search";

/**
 * Props for GlobalSearch component
 */
interface GlobalSearchProps {
  /** Placeholder text for the input */
  placeholder?: string;
  /** Custom class name */
  className?: string;
  /** Whether to show the search icon */
  showIcon?: boolean;
  /** Callback when search is submitted */
  onSearch?: (query: string) => void;
  /** Callback when a result is selected */
  onSelectResult?: (result: { id: string; type: string; url: string }) => void;
  /** Custom URL to navigate to on search (query will be appended) */
  searchUrl?: string;
  /** Whether the search is in a dialog/modal */
  inDialog?: boolean;
}

/**
 * Global search component with auto-complete suggestions.
 *
 * Features:
 * - Debounced suggestions as you type
 * - Keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
 * - Click to select suggestion
 * - Recent searches when input is empty
 * - Category labels for suggestions
 */
export function GlobalSearch({
  placeholder = "Search clients, programs, partners...",
  className,
  showIcon = true,
  onSearch,
  onSelectResult,
  searchUrl = "/search",
  inDialog = false,
}: GlobalSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch suggestions
  const {
    data: suggestionsData,
    isLoading: suggestionsLoading,
  } = useSearchSuggestions(query, 200, isOpen);

  const addRecentSearch = useAddRecentSearch();

  // Total items for keyboard navigation
  const totalItems = suggestionsData?.suggestions.length || 0;

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestionsData?.suggestions]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      setQuery(suggestion.text);
      setIsOpen(false);

      // Record the search
      addRecentSearch(suggestion.text, "global");

      // If it's an entity suggestion, navigate to search with that term
      if (onSearch) {
        onSearch(suggestion.text);
      } else {
        router.push(`${searchUrl}?q=${encodeURIComponent(suggestion.text)}`);
      }
    },
    [addRecentSearch, onSearch, router, searchUrl]
  );

  // Handle selecting a recent search
  const handleSelectRecentSearch = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery);
      setIsOpen(false);

      if (onSearch) {
        onSearch(recentQuery);
      } else {
        router.push(`${searchUrl}?q=${encodeURIComponent(recentQuery)}`);
      }
    },
    [onSearch, router, searchUrl]
  );

  // Handle submitting the search form
  const handleSubmitSearch = useCallback(() => {
    if (!query.trim()) return;

    // Record the search
    addRecentSearch(query.trim(), "global");
    setIsOpen(false);

    if (onSearch) {
      onSearch(query.trim());
    } else {
      router.push(`${searchUrl}?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, addRecentSearch, onSearch, router, searchUrl]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (suggestionsData?.suggestions[selectedIndex]) {
            handleSelectSuggestion(suggestionsData.suggestions[selectedIndex]);
          } else if (query.trim()) {
            handleSubmitSearch();
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [selectedIndex, totalItems, suggestionsData, query, handleSelectSuggestion, handleSubmitSearch]
  );

  // Handle clicking a search result
  const _handleSelectResult = useCallback(
    (result: { id: string; type: string; url: string }) => {
      setIsOpen(false);

      if (onSelectResult) {
        onSelectResult(result);
      } else {
        router.push(result.url);
      }
    },
    [onSelectResult, router]
  );

  // Handle input focus
  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Handle input change
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsOpen(true);
    },
    []
  );

  // Handle clearing the input
  const handleClear = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen && !inDialog) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, inDialog]);

  const isLoading = suggestionsLoading;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        {showIcon && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "w-full",
            showIcon && "pl-9",
            query && "pr-9"
          )}
          aria-label="Search"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1">
          <SearchSuggestions
            query={query}
            suggestions={suggestionsData?.suggestions || []}
            selectedIndex={selectedIndex}
            onSelectSuggestion={handleSelectSuggestion}
            onHoverSuggestion={setSelectedIndex}
            isLoading={suggestionsLoading}
            showRecentSearches={true}
            onSelectRecentSearch={handleSelectRecentSearch}
          />
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
