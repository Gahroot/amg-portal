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

  const hasReadReceipt = message.read_receipts && Object.keys(message.read_receipts).length > 0;

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

        {/* Message body */}
        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>

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
          {isOwn && hasReadReceipt && (
            <CheckCheck className="h-3 w-3" />
          )}
          {isOwn && !hasReadReceipt && message.status === "sent" && (
            <Check className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
}
