import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportPreviewResponse } from "@/types/custom-report";
import { renderCellValue } from "./render-cell-value";

interface PreviewTableProps {
  preview: ReportPreviewResponse | null | undefined;
  isPreviewing: boolean;
  page: number;
  totalPages: number;
  onPageChange: (updater: (p: number) => number) => void;
}

export function PreviewTable({
  preview,
  isPreviewing,
  page,
  totalPages,
  onPageChange,
}: PreviewTableProps) {
  return (
    <Card className="flex-1 overflow-hidden">
      <CardHeader className="flex-row items-center justify-between py-3">
        <div>
          <CardTitle className="text-sm">
            Preview
            {preview && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {preview.total.toLocaleString()} rows
              </span>
            )}
          </CardTitle>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isPreviewing && <span>Loading…</span>}
          {preview && totalPages > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={page === 1}
                onClick={() => onPageChange((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={page >= totalPages}
                onClick={() => onPageChange((p) => p + 1)}
              >
                Next
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-72">
          {preview && preview.columns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.columns.map((col) => (
                    <TableHead key={col.key} className="text-xs whitespace-nowrap">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={preview.columns.length}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No data matches the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  preview.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      {preview.columns.map((col) => (
                        <TableCell
                          key={col.key}
                          className="max-w-[200px] truncate text-xs"
                        >
                          {row[col.key] == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            renderCellValue(row[col.key], col.type)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {isPreviewing ? "Loading preview…" : "Add columns to see a preview."}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
