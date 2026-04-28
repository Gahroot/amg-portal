"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { MessageSquare, Reply, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/providers/auth-provider";
import {
  addApprovalComment,
  deleteApprovalComment,
  getApprovalComments,
} from "@/lib/api/approvals";
import type { ApprovalComment, ApprovalCommentCreate } from "@/types/approval";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000 * 60 * 48) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

// ─── Single Comment ───────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: ApprovalComment;
  entityId: string;
  entityType: string;
  depth?: number;
  onReply: (parentId: string, authorName: string) => void;
  currentUserId: string | undefined;
  currentUserRole: string | undefined;
}

function CommentItem({
  comment,
  entityId,
  entityType,
  depth = 0,
  onReply,
  currentUserId,
  currentUserRole,
}: CommentItemProps) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteApprovalComment(entityId, comment.id, entityType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["approval-comments", entityId, entityType],
      });
      toast.success("Comment deleted");
    },
    onError: () => toast.error("Failed to delete comment"),
  });

  const canDelete =
    currentUserId === comment.author_id ||
    currentUserRole === "managing_director";

  return (
    <div className={depth > 0 ? "ml-8 border-l-2 border-muted pl-4" : ""}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {initials(comment.author_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {comment.author_name}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default text-xs text-muted-foreground">
                  {formatTimestamp(comment.created_at)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {format(new Date(comment.created_at), "PPpp")}
              </TooltipContent>
            </Tooltip>
            {comment.is_internal && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                Internal
              </Badge>
            )}
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
            {comment.content}
          </p>

          <div className="mt-1.5 flex items-center gap-2">
            {depth === 0 && (
              <button
                onClick={() => onReply(comment.id, comment.author_name)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="flex items-center gap-1 text-xs text-destructive/70 hover:text-destructive transition-colors"
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              entityId={entityId}
              entityType={entityType}
              depth={depth + 1}
              onReply={onReply}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete comment?"
        description="This will permanently delete the comment and cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}

// ─── Compose Box ─────────────────────────────────────────────────────────────

interface ComposeBoxProps {
  entityId: string;
  entityType: string;
  replyTo: { parentId: string; authorName: string } | null;
  onCancelReply: () => void;
}

function ComposeBox({
  entityId,
  entityType,
  replyTo,
  onCancelReply,
}: ComposeBoxProps) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  const addMutation = useMutation({
    mutationFn: (data: ApprovalCommentCreate) =>
      addApprovalComment(entityId, data, entityType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["approval-comments", entityId, entityType],
      });
      setContent("");
      onCancelReply();
      toast.success("Comment posted");
    },
    onError: () => toast.error("Failed to post comment"),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    addMutation.mutate({
      content: content.trim(),
      is_internal: isInternal,
      parent_id: replyTo?.parentId ?? null,
      mentioned_user_ids: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {replyTo && (
        <div className="flex items-center justify-between rounded bg-muted px-3 py-1.5 text-sm">
          <span className="text-muted-foreground">
            Replying to{" "}
            <span className="font-medium text-foreground">
              {replyTo.authorName}
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          replyTo
            ? `Reply to ${replyTo.authorName}…`
            : "Add a comment… (use @[Name](uuid) for mentions)"
        }
        rows={3}
        className="resize-none"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="is-internal"
            checked={isInternal}
            onCheckedChange={setIsInternal}
          />
          <Label
            htmlFor="is-internal"
            className="flex cursor-pointer items-center gap-1 text-sm"
          >
            {isInternal ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                Internal only
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" />
                Visible to client
              </>
            )}
          </Label>
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || addMutation.isPending}
        >
          {addMutation.isPending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ApprovalCommentsProps {
  entityId: string;
  entityType?: string;
  /** Whether to show comments with is_internal=true (default true for internal users). */
  showInternal?: boolean;
}

export function ApprovalComments({
  entityId,
  entityType = "program_approval",
  showInternal = true,
}: ApprovalCommentsProps) {
  const { user } = useAuth();
  const [replyTo, setReplyTo] = useState<{
    parentId: string;
    authorName: string;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["approval-comments", entityId, entityType],
    queryFn: () => getApprovalComments(entityId, entityType, showInternal),
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">Failed to load comments.</p>
    );
  }

  const comments = data?.comments ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {total === 0
            ? "No comments yet"
            : `${total} comment${total !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Thread */}
      {comments.length > 0 && (
        <div className="divide-y divide-border">
          {comments.map((comment, i) => (
            <Fragment key={comment.id}>
              <CommentItem
                comment={comment}
                entityId={entityId}
                entityType={entityType}
                onReply={(parentId, authorName) =>
                  setReplyTo({ parentId, authorName })
                }
                currentUserId={user?.id}
                currentUserRole={user?.role}
              />
              {i < comments.length - 1 && null}
            </Fragment>
          ))}
        </div>
      )}

      {comments.length > 0 && <Separator />}

      {/* Compose */}
      <ComposeBox
        entityId={entityId}
        entityType={entityType}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
