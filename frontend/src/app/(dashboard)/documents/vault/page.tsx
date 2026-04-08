import { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Evidence Vault",
  description: "Sealed and archived documents for compliance and audit purposes.",
};
import { DocumentVault } from "@/components/documents/document-vault";

export default function VaultPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Evidence Vault</h1>
          <p className="text-sm text-muted-foreground">
            Sealed and archived documents for compliance and audit purposes
          </p>
        </div>
      </div>
      <DocumentVault />
    </div>
  );
}
