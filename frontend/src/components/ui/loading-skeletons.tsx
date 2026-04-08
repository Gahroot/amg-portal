import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ============================================================================
// PageHeaderSkeleton — page title + subtitle line
// ============================================================================

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

// ============================================================================
// CardGridSkeleton — row of metric/summary cards
// ============================================================================

interface CardGridSkeletonProps {
  /** Number of cards to render (default: 4) */
  count?: number;
  /** Tailwind grid-cols class override */
  gridClass?: string;
}

export function CardGridSkeleton({
  count = 4,
  gridClass = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
}: CardGridSkeletonProps) {
  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-1 h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// TableSkeleton — header row + N body rows across M columns
// ============================================================================

interface TableSkeletonProps {
  /** Number of body rows (default: 6) */
  rows?: number;
  /** Number of columns (default: 4) */
  columns?: number;
}

export function TableSkeleton({ rows = 6, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }, (_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRow key={i}>
              {Array.from({ length: columns }, (_, j) => (
                <TableCell key={j}>
                  <Skeleton className={`h-4 ${j === 0 ? "w-36" : "w-20"}`} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// FormSkeleton — label + input pairs with a submit button
// ============================================================================

interface FormSkeletonProps {
  /** Number of label/input pairs (default: 4) */
  fields?: number;
}

export function FormSkeleton({ fields = 4 }: FormSkeletonProps) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
