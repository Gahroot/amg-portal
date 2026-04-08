import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className utility)", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes - false value is ignored", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("handles undefined", () => {
    expect(cn("base", undefined, "end")).toBe("base end");
  });

  it("handles null", () => {
    expect(cn("base", null, "end")).toBe("base end");
  });

  it("handles undefined and null together", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("deduplicates conflicting tailwind classes - keeps last", () => {
    // twMerge resolves conflicts by keeping the last class
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges non-conflicting tailwind classes", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles single class", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("handles object syntax (clsx feature)", () => {
    expect(cn({ "text-bold": true, "text-italic": false })).toBe("text-bold");
  });

  it("handles array syntax (clsx feature)", () => {
    expect(cn(["flex", "items-center"])).toBe("flex items-center");
  });

  it("handles nested arrays", () => {
    expect(cn(["flex", ["items-center", "justify-between"]])).toBe(
      "flex items-center justify-between"
    );
  });

  it("handles conditional object classes", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn({ "bg-blue-500": isActive, "opacity-50": isDisabled })).toBe(
      "bg-blue-500"
    );
  });

  it("resolves conflicting text color classes - last wins", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("resolves conflicting background classes - last wins", () => {
    expect(cn("bg-red-100", "bg-green-200")).toBe("bg-green-200");
  });

  it("handles empty string class", () => {
    expect(cn("", "foo")).toBe("foo");
  });

  it("handles mixed types - string, object, array", () => {
    const result = cn("base", { "extra-class": true }, ["array-class"]);
    expect(result).toContain("base");
    expect(result).toContain("extra-class");
    expect(result).toContain("array-class");
  });

  it("resolves padding conflicts properly", () => {
    // p-4 conflicts with px-2 in tailwind-merge
    expect(cn("p-4", "px-2")).toBe("p-4 px-2");
  });

  it("handles boolean false in object", () => {
    expect(cn({ hidden: false, visible: true })).toBe("visible");
  });
});
