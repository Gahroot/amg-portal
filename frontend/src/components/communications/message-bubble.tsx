"use client";

import { format } from "date-fns";
import type { Communication } from "@/types/communication";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Communication;
  currentUserId?: string;
}

/**
 * Simple markdown-to-HTML converter for basic formatting.
 * Supports: **bold**, _italic_, [links](url), and lists
 */
function renderMarkdown(text: string): string {
  let html = text;

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic: _text_
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">$1</a>'
  );

  // Bullet lists: - item
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');

  // Numbered lists: 1. item
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // Preserve line breaks
  html = html.replace(/\n/g, "<br />");

  return html;
}

export function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isOwn = message.sender_id === currentUserId;
  const sentAt = message.sent_at || message.created_at;

  const getInitials = (name?: string) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Count how many recipients have read the message (excluding sender)
  const readCount = message.read_receipts
    ? Object.keys(message.read_receipts).filter((id) => id !== message.sender_id).length
    : 0;

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      {!isOwn && (
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs bg-muted">
            {getInitials(message.sender_name)}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-4 py-2",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {/* Sender name for group conversations */}
        {!isOwn && message.sender_name && (
          <p className="mb-1 text-xs font-semibold opacity-70">{message.sender_name}</p>
        )}

        {/* Message body with markdown rendering */}
        <div
          className="break-words text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body) }}
        />

        {/* Attachments */}
        {message.attachment_ids && message.attachment_ids.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachment_ids.map((id) => (
              <div
                key={id}
                className="flex items-center gap-1 rounded bg-background/10 px-2 py-1 text-xs"
              >
                📎 Attachment
              </div>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-xs opacity-70",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          {sentAt && (
            <span>{format(new Date(sentAt), "h:mm a")}</span>
          )}
          {isOwn && (
            <span className="flex items-center">
              {readCount > 0 ? (
                <span className="flex items-center gap-0.5" title={`Read by ${readCount} recipient${readCount > 1 ? "s" : ""}`}>
                  <CheckCheck className="h-3 w-3" />
                </span>
              ) : message.status === "sent" ? (
                <span title="Sent">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
