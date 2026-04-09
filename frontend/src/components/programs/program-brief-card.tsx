"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Eye, EyeOff, Share2, Pencil, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { updateProgramBrief, shareProgramBrief } from "@/lib/api/programs";

interface ProgramBriefCardProps {
  programId: string;
  briefContent: string | null;
  briefVisibleToClient: boolean;
  briefSharedAt: string | null;
  canEdit: boolean;
}

export function ProgramBriefCard({
  programId,
  briefContent,
  briefVisibleToClient,
  briefSharedAt,
  canEdit,
}: ProgramBriefCardProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(briefContent ?? "");

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      updateProgramBrief(programId, { brief_content: content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", programId] });
      setEditing(false);
      toast.success("Brief saved");
    },
    onError: () => toast.error("Failed to save brief"),
  });

  const shareMutation = useMutation({
    mutationFn: () => shareProgramBrief(programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", programId] });
      toast.success("Brief shared with client");
    },
    onError: () => toast.error("Failed to share brief"),
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      updateProgramBrief(programId, { brief_visible_to_client: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["programs", programId] });
      toast.success("Brief visibility revoked");
    },
    onError: () => toast.error("Failed to revoke brief visibility"),
  });

  const handleEdit = () => {
    setDraft(briefContent ?? "");
    setEditing(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="font-serif text-xl">Program Brief</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={briefVisibleToClient ? "default" : "outline"}>
              {briefVisibleToClient ? (
                <><Eye className="mr-1 h-3 w-3" /> Visible to Client</>
              ) : (
                <><EyeOff className="mr-1 h-3 w-3" /> Internal Only</>
              )}
            </Badge>
            {canEdit && !editing && (
              <Button variant="ghost" size="sm" onClick={handleEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              placeholder="Write the program brief..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(draft)}
              >
                <Check className="mr-1 h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            {briefContent ? (
              <p className="text-sm whitespace-pre-wrap">{briefContent}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No brief content yet.
                {canEdit && " Click the pencil icon to add one."}
              </p>
            )}
          </>
        )}

        {briefSharedAt && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Shared on {new Date(briefSharedAt).toLocaleString()}
            </p>
          </>
        )}

        {canEdit && briefContent && !editing && (
          <>
            <Separator />
            <div className="flex gap-2">
              {briefVisibleToClient ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate()}
                >
                  <EyeOff className="mr-1 h-4 w-4" />
                  {revokeMutation.isPending ? "Revoking..." : "Revoke Visibility"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={shareMutation.isPending}
                  onClick={() => shareMutation.mutate()}
                >
                  <Share2 className="mr-1 h-4 w-4" />
                  {shareMutation.isPending ? "Sharing..." : "Share with Client"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
