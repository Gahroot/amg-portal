"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useProgram } from "@/hooks/use-programs";
import { useProgramGantt } from "@/hooks/use-program-gantt";
import { GanttChart } from "@/components/programs/gantt-chart";
import { GanttToolbar } from "@/components/programs/gantt-toolbar";
import type { ZoomLevel, GanttFilters } from "@/components/programs/gantt-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, GitBranch } from "lucide-react";

export default function ProgramTimelinePage() {
  const params = useParams();
  const router = useRouter();
  const programId = params.id as string;

  const { data: program, isLoading } = useProgram(programId);
  const ganttData = useProgramGantt(program);

  const [zoom, setZoom] = React.useState<ZoomLevel>("week");
  const [filters, setFilters] = React.useState<GanttFilters>({
    hideCompleted: false,
    showOnlyCritical: false,
    hideTasks: false,
  });
  const [isExporting, setIsExporting] = React.useState(false);

  const svgRef = React.useRef<SVGSVGElement | null>(null);

  const handleExport = React.useCallback(async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    try {
      const svg = svgRef.current;
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 2; // retina
        canvas.width = svg.width.baseVal.value * scale;
        canvas.height = svg.height.baseVal.value * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(scale, scale);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-card').trim() || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `${program?.title ?? "program"}-gantt.png`;
          link.click();
          setIsExporting(false);
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };
      img.src = url;
    } catch {
      setIsExporting(false);
    }
  }, [program?.title]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-muted-foreground">Program not found.</p>
        </div>
      </div>
    );
  }

  const criticalCount = ganttData.criticalPathIds.size;
  const totalItems = ganttData.items.length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/programs/${programId}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Program
            </Button>
            <div className="h-5 w-px bg-border" />
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight">
                {program.title} — Timeline
              </h1>
              <p className="text-sm text-muted-foreground">
                {program.start_date
                  ? new Date(program.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "No start date"}
                {" → "}
                {program.end_date
                  ? new Date(program.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "No end date"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <GitBranch className="h-3 w-3" />
              {totalItems} items
            </Badge>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="gap-1.5">
                ⚡ {criticalCount} critical
              </Badge>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <GanttToolbar
          zoom={zoom}
          onZoomChange={setZoom}
          filters={filters}
          onFiltersChange={setFilters}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {/* Gantt Chart */}
        <GanttChart
          items={ganttData.items}
          dependencies={ganttData.dependencies}
          projectStart={ganttData.projectStart}
          projectEnd={ganttData.projectEnd}
          zoom={zoom}
          filters={filters}
          svgRef={svgRef}
        />

        {/* Empty state guidance */}
        {ganttData.items.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <p className="font-medium">No milestones or tasks yet.</p>
            <p className="mt-1">
              Add milestones with due dates from the{" "}
              <button
                className="underline underline-offset-2 hover:text-foreground"
                onClick={() => router.push(`/programs/${programId}?tab=milestones`)}
              >
                Milestones tab
              </button>{" "}
              to see the Gantt chart.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
