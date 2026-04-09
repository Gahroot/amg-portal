"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, Contrast } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeToggleProps {
  /** Button variant to use */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button size to use */
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
  /** Show label alongside icon */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/** Hook to manage high contrast mode */
function useHighContrast() {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    // Check localStorage
    const stored = localStorage.getItem("high-contrast");
    if (stored !== null) {
      setHighContrast(stored === "true");
    } else {
      // Check system preference
      const prefersContrast = window.matchMedia("(prefers-contrast: more)").matches;
      setHighContrast(prefersContrast);
    }
  }, []);

  useEffect(() => {
    // Apply or remove high-contrast class on html element
    const html = document.documentElement;
    if (highContrast) {
      html.classList.add("high-contrast");
    } else {
      html.classList.remove("high-contrast");
    }
    // Persist to localStorage
    localStorage.setItem("high-contrast", String(highContrast));
  }, [highContrast]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: more)");
    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("high-contrast");
      // Only auto-update if user hasn't manually set preference
      if (stored === null) {
        setHighContrast(e.matches);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return { highContrast, setHighContrast };
}

/**
 * Theme toggle component using next-themes.
 * Supports Light, Dark, System, and High Contrast preferences.
 */
export function ThemeToggle({
  variant = "outline",
  size = "icon",
  showLabel = false,
  className,
}: ThemeToggleProps) {
  const { setTheme, theme } = useTheme();
  const { highContrast, setHighContrast } = useHighContrast();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Sun className="h-[1.2rem] w-[1.2rem]" />
        {showLabel && <span className="ml-2">Theme</span>}
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {highContrast ? (
            <Contrast className="h-[1.2rem] w-[1.2rem]" />
          ) : (
            <>
              <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            </>
          )}
          {showLabel && (
            <span className="ml-2 capitalize">
              {highContrast ? "High Contrast" : theme === "system" ? "System" : theme}
            </span>
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => {
          setTheme("light");
          setHighContrast(false);
        }}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          setTheme("dark");
          setHighContrast(false);
        }}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          setTheme("system");
          setHighContrast(false);
        }}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Contrast className="mr-2 h-4 w-4" />
            High Contrast
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => {
              setTheme("light");
              setHighContrast(true);
            }}>
              <Sun className="mr-2 h-4 w-4" />
              Light (High Contrast)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setTheme("dark");
              setHighContrast(true);
            }}>
              <Moon className="mr-2 h-4 w-4" />
              Dark (High Contrast)
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Inline theme toggle for settings pages.
 * Shows radio-style buttons instead of a dropdown.
 * Includes high contrast mode options.
 */
export function ThemeToggleInline() {
  const { setTheme, theme } = useTheme();
  const { highContrast, setHighContrast } = useHighContrast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex gap-2">
        {["light", "dark", "system"].map((t) => (
          <Button
            key={t}
            variant="outline"
            size="sm"
            disabled
            className="gap-2 capitalize"
          >
            {t === "light" && <Sun className="h-4 w-4" />}
            {t === "dark" && <Moon className="h-4 w-4" />}
            {t === "system" && <Monitor className="h-4 w-4" />}
            {t}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={theme === "light" && !highContrast ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setTheme("light");
            setHighContrast(false);
          }}
          className="gap-2"
        >
          <Sun className="h-4 w-4" />
          Light
        </Button>
        <Button
          variant={theme === "dark" && !highContrast ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setTheme("dark");
            setHighContrast(false);
          }}
          className="gap-2"
        >
          <Moon className="h-4 w-4" />
          Dark
        </Button>
        <Button
          variant={theme === "system" && !highContrast ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setTheme("system");
            setHighContrast(false);
          }}
          className="gap-2"
        >
          <Monitor className="h-4 w-4" />
          System
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook to access high contrast state from other components.
 * Export for use in settings pages and other components.
 */
export { useHighContrast };
