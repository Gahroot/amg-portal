"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listTemplates,
  deleteTemplate,
  type CertificateTemplate,
} from "@/lib/api/clearance-certificates";
import { toast } from "sonner";

const ALLOWED_ROLES = ["finance_compliance", "managing_director"];

export default function TemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true);
      try {
        const response = await listTemplates();
        setTemplates(response.templates);
        setTotal(response.total);
      } catch (error) {
        console.error("Failed to load templates:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadTemplates();
  }, []);

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteTemplate(pendingDeleteId);
      setTemplates(templates.filter((t) => t.id !== pendingDeleteId));
      setTotal(total - 1);
      setPendingDeleteId(null);
    } catch {
      toast.error("Failed to delete template");
    }
  };

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">
            Certificate Templates
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage reusable templates for clearance certificates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/certificates">Back to Certificates</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="capitalize">{template.template_type}</TableCell>
                  <TableCell>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {template.description || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/certificates/templates/${template.id}`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDelete(template.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {templates.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No templates found. Templates can be created via the API.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <p className="text-sm text-muted-foreground">
          {total} template{total !== 1 ? "s" : ""} total
        </p>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete template?"
        description="This will permanently delete the template and cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
