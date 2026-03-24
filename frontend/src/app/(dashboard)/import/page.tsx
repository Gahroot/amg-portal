import { ImportWizard } from "@/components/import/import-wizard";

export const metadata = {
  title: "Import Data | AMG Portal",
  description: "Import clients, partners, programs, and tasks from CSV or Excel files",
};

export default function ImportPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold">Import Data</h1>
        <p className="text-muted-foreground mt-2">
          Import your data from CSV or Excel files with guided validation and error handling.
        </p>
      </div>

      <ImportWizard />
    </div>
  );
}
