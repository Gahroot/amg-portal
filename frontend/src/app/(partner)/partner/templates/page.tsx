import { Metadata } from "next";
import { TemplateLibrary } from "@/components/partners/template-library";

export const metadata: Metadata = {
  title: "Template Library | AMG Partner Portal",
  description: "Download pre-formatted templates for security reports, travel assessments, incident reports, and financial summaries.",
};

export default function TemplatesPage() {
  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Template Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and download pre-formatted templates to get started on your deliverables.
        </p>
      </div>
      <TemplateLibrary />
    </div>
  );
}
