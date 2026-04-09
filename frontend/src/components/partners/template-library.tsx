"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listDeliverableTemplates,
  getTemplateCategories,
  getTemplateDownloadUrl,
} from "@/lib/api/deliverable-templates";
import type {
  DeliverableTemplate,
  TemplateCategoryInfo,
} from "@/lib/api/deliverable-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  FileText,
  Search,
  Shield,
  MapPin,
  AlertTriangle,
  DollarSign,
  Folder,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, ReactNode> = {
  security_reports: <Shield className="h-4 w-4" />,
  travel_assessments: <MapPin className="h-4 w-4" />,
  incident_reports: <AlertTriangle className="h-4 w-4" />,
  financial_summaries: <DollarSign className="h-4 w-4" />,
  general: <Folder className="h-4 w-4" />,
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(mime: string | null): string {
  if (!mime) return "File";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("docx")) return "Word";
  if (mime.includes("excel") || mime.includes("spreadsheet") || mime.includes("xlsx"))
    return "Excel";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PowerPoint";
  if (mime.includes("text")) return "Text";
  return "File";
}

// ---------------------------------------------------------------------------
// TemplateCard
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: DeliverableTemplate;
}

function TemplateCard({ template }: TemplateCardProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!template.file_name && !template.download_url) {
      toast.error("No file attached to this template yet.");
      return;
    }
    setDownloading(true);
    try {
      // Use preloaded download_url if available; otherwise fetch a fresh one
      let url = template.download_url;
      if (!url) {
        const data = await getTemplateDownloadUrl(template.id);
        url = data.download_url;
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = template.file_name ?? template.name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading "${template.name}"`);
    } catch {
      toast.error("Failed to download template. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const hasFile = Boolean(template.file_name || template.download_url);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold leading-tight">
              {template.name}
            </CardTitle>
          </div>
          {template.file_type && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {fileTypeLabel(template.file_type)}
            </Badge>
          )}
        </div>
        {template.description && (
          <CardDescription className="text-xs leading-relaxed">
            {template.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {template.file_size ? formatFileSize(template.file_size) : ""}
          </span>
          <Button
            size="sm"
            variant={hasFile ? "default" : "outline"}
            disabled={!hasFile || downloading}
            onClick={handleDownload}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Downloading…" : "Download"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TemplateGrid
// ---------------------------------------------------------------------------

interface TemplateGridProps {
  category?: string;
  search?: string;
}

function TemplateGrid({ category, search }: TemplateGridProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["deliverable-templates", { category, search }],
    queryFn: () =>
      listDeliverableTemplates({
        category: category && category !== "all" ? category : undefined,
        search: search || undefined,
        limit: 50,
      }),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1 h-3 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load templates. Please refresh.</AlertDescription>
      </Alert>
    );
  }

  if (!data?.templates.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <FileText className="h-12 w-12 opacity-30" />
        <p className="text-sm">
          {search ? `No templates match "${search}".` : "No templates in this category yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.templates.map((t) => (
        <TemplateCard key={t.id} template={t} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateLibrary (main export)
// ---------------------------------------------------------------------------

export function TemplateLibrary() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ["deliverable-template-categories"],
    queryFn: getTemplateCategories,
    staleTime: 5 * 60 * 1000,
  });

  const allCategories: TemplateCategoryInfo[] = useMemo(
    () => [{ key: "all", label: "All Templates", count: categories?.reduce((s, c) => s + c.count, 0) ?? 0 }, ...(categories ?? [])],
    [categories]
  );

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search templates…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex w-auto">
            {catLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="mx-1 h-8 w-24 rounded-md" />
                ))
              : allCategories.map((cat) => (
                  <TabsTrigger key={cat.key} value={cat.key} className="gap-1.5 text-xs">
                    {CATEGORY_ICONS[cat.key]}
                    <span>{cat.label}</span>
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 px-1.5 text-[10px]"
                    >
                      {cat.count}
                    </Badge>
                  </TabsTrigger>
                ))}
          </TabsList>
        </div>

        {allCategories.map((cat) => (
          <TabsContent key={cat.key} value={cat.key} className="mt-4">
            <TemplateGrid
              category={cat.key === "all" ? undefined : cat.key}
              search={debouncedSearch}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssignmentTemplateSuggestions — inline widget for assignment detail page
// ---------------------------------------------------------------------------

interface AssignmentTemplateSuggestionsProps {
  assignmentTitle: string;
  deliverableType?: string;
}

export function AssignmentTemplateSuggestions({
  assignmentTitle,
  deliverableType,
}: AssignmentTemplateSuggestionsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["template-suggestions", assignmentTitle, deliverableType],
    queryFn: () =>
      listDeliverableTemplates({
        search: assignmentTitle.split(" ").slice(0, 3).join(" ") || undefined,
        deliverable_type: deliverableType,
        limit: 4,
      }),
    enabled: Boolean(assignmentTitle),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data?.templates.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Suggested Templates
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.templates.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
