import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateCsv,
  generateXlsx,
  downloadFile,
  exportToCsv,
  exportToXlsx,
  exportData,
  type ExportColumn,
} from "@/lib/export-utils";

// ---- generateCsv Tests ----

describe("generateCsv", () => {
  interface TestRow {
    name: string;
    email: string;
    score: number;
  }

  const columns: ExportColumn<TestRow>[] = [
    { header: "Name", accessor: "name" },
    { header: "Email", accessor: "email" },
    { header: "Score", accessor: "score" },
  ];

  it("generates CSV with header and data rows", () => {
    const rows: TestRow[] = [
      { name: "Alice", email: "alice@test.com", score: 95 },
      { name: "Bob", email: "bob@test.com", score: 87 },
    ];
    const csv = generateCsv(rows, columns);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Email,Score");
    expect(lines[1]).toBe("Alice,alice@test.com,95");
    expect(lines[2]).toBe("Bob,bob@test.com,87");
  });

  it("generates header even with empty rows", () => {
    const csv = generateCsv([], columns);
    // The implementation returns `${header}\n${body}` where body is ""
    // So result is "Name,Email,Score\n"
    expect(csv).toContain("Name,Email,Score");
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Email,Score");
  });

  it("escapes values with commas", () => {
    const rows: TestRow[] = [
      { name: "Smith, Jr.", email: "test@test.com", score: 100 },
    ];
    const csv = generateCsv(rows, columns);
    expect(csv).toContain('"Smith, Jr."');
  });

  it("escapes values with double quotes", () => {
    const rows: TestRow[] = [
      { name: 'He said "hello"', email: "test@test.com", score: 50 },
    ];
    const csv = generateCsv(rows, columns);
    expect(csv).toContain('""hello""');
  });

  it("escapes values with newlines", () => {
    const rows: TestRow[] = [
      { name: "Line1\nLine2", email: "test@test.com", score: 50 },
    ];
    const csv = generateCsv(rows, columns);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("supports accessor functions", () => {
    const fnColumns: ExportColumn<TestRow>[] = [
      { header: "Display", accessor: (row) => `${row.name} (${row.score})` },
    ];
    const rows: TestRow[] = [{ name: "Alice", email: "a@t.com", score: 95 }];
    const csv = generateCsv(rows, fnColumns);
    expect(csv).toContain("Alice (95)");
  });

  it("handles null values", () => {
    interface OptionalRow {
      name: string | null;
      value: number | undefined;
    }
    const optColumns: ExportColumn<OptionalRow>[] = [
      { header: "Name", accessor: "name" },
      { header: "Value", accessor: "value" },
    ];
    const rows: OptionalRow[] = [{ name: null, value: undefined }];
    const csv = generateCsv(rows, optColumns);
    expect(csv).toContain("Name,Value");
    // null and undefined become empty strings
    expect(csv.split("\n")[1]).toBe(",");
  });

  it("generates correct single-row CSV", () => {
    const rows: TestRow[] = [
      { name: "Alice", email: "alice@test.com", score: 100 },
    ];
    const csv = generateCsv(rows, columns);
    expect(csv).toBe("Name,Email,Score\nAlice,alice@test.com,100");
  });

  it("handles header with special characters", () => {
    const specialColumns: ExportColumn<TestRow>[] = [
      { header: "Name, Surname", accessor: "name" },
    ];
    const csv = generateCsv([], specialColumns);
    expect(csv).toContain('"Name, Surname"');
  });

  it("generates correct multi-row CSV", () => {
    const rows: TestRow[] = [
      { name: "Alice", email: "alice@test.com", score: 95 },
      { name: "Bob", email: "bob@test.com", score: 87 },
      { name: "Carol", email: "carol@test.com", score: 72 },
    ];
    const csv = generateCsv(rows, columns);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("Carol,carol@test.com,72");
  });
});

// ---- generateXlsx Tests ----

describe("generateXlsx", () => {
  interface SimpleRow {
    col1: string;
    col2: number;
  }

  const columns: ExportColumn<SimpleRow>[] = [
    { header: "Column 1", accessor: "col1" },
    { header: "Column 2", accessor: "col2" },
  ];

  it("generates valid SpreadsheetML XML", () => {
    const rows: SimpleRow[] = [{ col1: "hello", col2: 42 }];
    const xml = generateXlsx(rows, columns);
    expect(xml).toContain("<?xml version");
    expect(xml).toContain("<Workbook");
    expect(xml).toContain("Column 1");
    expect(xml).toContain("hello");
    expect(xml).toContain("42");
  });

  it("escapes XML special characters - angle brackets", () => {
    const rows: SimpleRow[] = [
      { col1: "<script>alert('xss')</script>", col2: 1 },
    ];
    const xml = generateXlsx(rows, columns);
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).not.toContain("<script>");
  });

  it("escapes ampersands", () => {
    const rows: SimpleRow[] = [{ col1: "A & B", col2: 1 }];
    const xml = generateXlsx(rows, columns);
    expect(xml).toContain("A &amp; B");
    // Should not contain unescaped ampersand in data
    // (Note: &amp; itself contains &, so we check for the raw "A & B" not appearing)
    expect(xml).not.toContain(">A & B<");
  });

  it("escapes double quotes", () => {
    const rows: SimpleRow[] = [{ col1: 'Say "hello"', col2: 1 }];
    const xml = generateXlsx(rows, columns);
    expect(xml).toContain("&quot;hello&quot;");
  });

  it("uses custom sheet name", () => {
    const xml = generateXlsx([], columns, "My Sheet");
    expect(xml).toContain('ss:Name="My Sheet"');
  });

  it("uses default sheet name 'Export'", () => {
    const xml = generateXlsx([], columns);
    expect(xml).toContain('ss:Name="Export"');
  });

  it("handles empty rows", () => {
    const xml = generateXlsx([], columns);
    expect(xml).toContain("Column 1");
    expect(xml).toContain("Column 2");
  });

  it("contains Worksheet element", () => {
    const xml = generateXlsx([], columns);
    expect(xml).toContain("<Worksheet");
    expect(xml).toContain("<Table>");
  });

  it("contains header row with bold style", () => {
    const xml = generateXlsx([], columns);
    expect(xml).toContain('ss:StyleID="header"');
  });

  it("generates cell data for each row", () => {
    const rows: SimpleRow[] = [
      { col1: "first", col2: 1 },
      { col1: "second", col2: 2 },
    ];
    const xml = generateXlsx(rows, columns);
    expect(xml).toContain("first");
    expect(xml).toContain("second");
    expect(xml).toContain(">1<");
    expect(xml).toContain(">2<");
  });

  it("escapes sheet name with special chars", () => {
    const xml = generateXlsx([], columns, 'Sheet & "Data"');
    expect(xml).toContain("Sheet &amp;");
    expect(xml).toContain("&quot;Data&quot;");
  });

  it("supports accessor functions", () => {
    const fnColumns: ExportColumn<SimpleRow>[] = [
      {
        header: "Combined",
        accessor: (row) => `${row.col1}-${row.col2}`,
      },
    ];
    const rows: SimpleRow[] = [{ col1: "test", col2: 5 }];
    const xml = generateXlsx(rows, fnColumns);
    expect(xml).toContain("test-5");
  });
});

// ---- downloadFile Tests ----

describe("downloadFile", () => {
  let mockAnchor: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAnchor = {
      href: "",
      download: "",
      click: vi.fn(),
    };

    globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as unknown as Node);
    vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as unknown as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an anchor element and triggers click", () => {
    downloadFile("content", "test.txt", "text/plain");
    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it("sets href to object URL", () => {
    downloadFile("content", "test.txt", "text/plain");
    expect(mockAnchor.href).toBe("blob:mock-url");
  });

  it("sets correct download filename", () => {
    downloadFile("content", "my-file.csv", "text/csv");
    expect(mockAnchor.download).toBe("my-file.csv");
  });

  it("appends and removes anchor from body", () => {
    downloadFile("content", "test.txt", "text/plain");
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
  });

  it("revokes object URL after download", () => {
    downloadFile("content", "test.txt", "text/plain");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

// ---- exportToCsv Tests ----

describe("exportToCsv", () => {
  interface Row {
    label: string;
    count: number;
  }

  const cols: ExportColumn<Row>[] = [
    { header: "Label", accessor: "label" },
    { header: "Count", accessor: "count" },
  ];

  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => "blob:csv-url");
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockReturnValue({} as Node);
    vi.spyOn(document.body, "removeChild").mockReturnValue({} as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers download with .csv extension", () => {
    const mockEl = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockEl as unknown as HTMLElement
    );
    exportToCsv([{ label: "A", count: 1 }], cols, "my-report");
    expect(mockEl.download).toBe("my-report.csv");
  });

  it("calls URL.createObjectURL", () => {
    exportToCsv([], cols, "empty");
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

// ---- exportToXlsx Tests ----

describe("exportToXlsx", () => {
  interface Row {
    label: string;
  }

  const cols: ExportColumn<Row>[] = [
    { header: "Label", accessor: "label" },
  ];

  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => "blob:xlsx-url");
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockReturnValue({} as Node);
    vi.spyOn(document.body, "removeChild").mockReturnValue({} as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers download with .xls extension", () => {
    const mockEl = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockEl as unknown as HTMLElement
    );
    exportToXlsx([{ label: "A" }], cols, "my-report");
    expect(mockEl.download).toBe("my-report.xls");
  });

  it("uses filename as sheet name when sheetName not provided", () => {
    // Can't directly inspect the XML here, but should not throw
    expect(() => exportToXlsx([], cols, "report")).not.toThrow();
  });
});

// ---- exportData Tests ----

describe("exportData", () => {
  interface Row {
    x: string;
  }

  const cols: ExportColumn<Row>[] = [{ header: "X", accessor: "x" }];

  beforeEach(() => {
    globalThis.URL.createObjectURL = vi.fn(() => "blob:url");
    globalThis.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLElement);
    vi.spyOn(document.body, "appendChild").mockReturnValue({} as Node);
    vi.spyOn(document.body, "removeChild").mockReturnValue({} as Node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports as CSV when format is 'csv'", () => {
    const mockEl = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockEl as unknown as HTMLElement
    );
    exportData([{ x: "val" }], cols, "data", "csv");
    expect(mockEl.download).toBe("data.csv");
  });

  it("exports as XLSX when format is 'xlsx'", () => {
    const mockEl = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockEl as unknown as HTMLElement
    );
    exportData([{ x: "val" }], cols, "data", "xlsx");
    expect(mockEl.download).toBe("data.xls");
  });
});
