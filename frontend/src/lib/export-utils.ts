/**
 * Client-side export utilities for data tables.
 * Supports CSV and XLSX (SpreadsheetML) formats.
 */

export type ExportFormat = "csv" | "xlsx";

export interface ExportColumn<T> {
  /** Column header label */
  header: string;
  /** Field key or accessor function */
  accessor: keyof T | ((row: T) => string | number | null | undefined);
}

/** Escape a value for CSV output */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote if contains comma, newline, or double-quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Get a cell value from a row using a column definition */
function getCellValue<T>(row: T, col: ExportColumn<T>): string {
  if (typeof col.accessor === "function") {
    return escapeCsvValue(col.accessor(row));
  }
  return escapeCsvValue(row[col.accessor as keyof T]);
}

/** Generate a CSV string from rows and column definitions */
export function generateCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
): string {
  const header = columns.map((c) => escapeCsvValue(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((col) => getCellValue(row, col)).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

/** Generate an Excel SpreadsheetML XML string from rows and column definitions */
export function generateXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  sheetName = "Export",
): string {
  function xmlEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cell(value: unknown): string {
    return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
  }

  function row(cells: string[]): string {
    return `<Row>${cells.join("")}</Row>`;
  }

  const headerRow = row(columns.map((c) => cell(c.header)));
  const dataRows = rows.map((r) =>
    row(
      columns.map((col) => {
        const val =
          typeof col.accessor === "function"
            ? col.accessor(r)
            : r[col.accessor as keyof T];
        return cell(val);
      }),
    ),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${xmlEscape(sheetName)}">
    <Table>
      ${headerRow.replace("<Row>", '<Row ss:StyleID="header">')}
      ${dataRows.join("\n      ")}
    </Table>
  </Worksheet>
</Workbook>`;
}

/** Trigger a file download in the browser */
export function downloadFile(
  content: string,
  fileName: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export data to CSV file */
export function exportToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
): void {
  const csv = generateCsv(rows, columns);
  // BOM for Excel UTF-8 compatibility
  downloadFile("\uFEFF" + csv, `${fileName}.csv`, "text/csv;charset=utf-8");
}

/** Export data to Excel file (SpreadsheetML format) */
export function exportToXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
  sheetName?: string,
): void {
  const xml = generateXlsx(rows, columns, sheetName ?? fileName);
  downloadFile(xml, `${fileName}.xls`, "application/vnd.ms-excel");
}

/** Export data in the specified format */
export function exportData<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  fileName: string,
  format: ExportFormat,
): void {
  if (format === "csv") {
    exportToCsv(rows, columns, fileName);
  } else {
    exportToXlsx(rows, columns, fileName);
  }
}

/**
 * Download an authenticated server-side export.
 *
 * Fetches the given URL with the stored Bearer token, then triggers a
 * browser download of the response body.  Use this when the export endpoint
 * requires authentication (i.e. it cannot be opened as a plain anchor link).
 */
export async function downloadServerExport(
  url: string,
  format: ExportFormat,
  fileName: string,
): Promise<void> {
  const { getAccessToken } = await import("@/lib/token-storage");
  const token = getAccessToken();

  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${url}${separator}format=${format}`;

  const response = await fetch(fullUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${fileName}.${format === "csv" ? "csv" : "xls"}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
