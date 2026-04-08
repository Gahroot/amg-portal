"use client";

import { useState, useRef, useEffect } from "react";
import { useConversation, useMessages, useSendMessage, useMarkConversationRead } from "@/hooks/use-conversations";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAuth } from "@/providers/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCompose } from "./message-compose";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { ArrowLeft, MoreVertical, Phone, Video, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Conversation, CommunicationListResponse } from "@/types/communication";
import type { UseMutationResult } from "@tanstack/react-query";

interface ConversationViewProps {
  conversationId: string;
  onBack?: () => void;
  /** Override default hooks for portals that use different API endpoints */
  overrides?: {
    conversation?: Conversation;
    isLoadingConversation?: boolean;
    messagesData?: CommunicationListResponse;
    isLoadingMessages?: boolean;
    sendMessage?: UseMutationResult<unknown, Error, { conversationId: string; data: { body: string; attachment_ids?: string[] } }>;
    markRead?: UseMutationResult<unknown, Error, string>;
  };
}

export function ConversationView({ conversationId, onBack, overrides }: ConversationViewProps) {
  const { user } = useAuth();

  const internalConv = useConversation(overrides ? "" : conversationId);
  const internalMessages = useMessages(overrides ? "" : conversationId, { limit: 100 });
  const internalSend = useSendMessage();
  const internalMarkRead = useMarkConversationRead();

  const conversation = overrides?.conversation ?? internalConv.data;
  const isLoadingConv = overrides?.isLoadingConversation ?? internalConv.isLoading;
  const messagesData = overrides?.messagesData ?? internalMessages.data;
  const isLoadingMessages = overrides?.isLoadingMessages ?? internalMessages.isLoading;
  const sendMessage = overrides?.sendMessage ?? internalSend;
  const markRead = overrides?.markRead ?? internalMarkRead;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typers, setTypers] = useState<Set<string>>(new Set());

  const { sendTypingIndicator } = useWebSocket({
    onNewMessage: (message) => {
      if (message.conversation_id === conversationId) {
        // Scroll to bottom and mark as read when a new message arrives in this conversation
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
        markRead.mutate(conversationId);
      }
    },
    onTyping: (data) => {
      if (data.conversation_id === conversationId) {
        setTypers((prev) => {
          const next = new Set(prev);
          if (data.is_typing) {
            next.add(data.user_id);
          } else {
            next.delete(data.user_id);
          }
          return next;
        });
      }
    },
  });

  // Mark conversation as read whenever it is opened (conversationId changes)
  useEffect(() => {
    if (conversationId) {
      markRead.mutate(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.communications.length]);

  const handleSendMessage = (body: string, attachmentIds?: string[]) => {
    sendMessage.mutate({
      conversationId,
      data: { body, attachment_ids: attachmentIds },
    });
    setTypers(new Set()); // Clear typing indicators
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoadingConv) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading conversation...</div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Conversation not found</div>
      </div>
    );
  }

  const otherParticipants = conversation.participants; // Would filter out current user

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            {otherParticipants.slice(0, 3).map((participant) => (
              <Avatar key={participant.id} className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(participant.full_name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {otherParticipants.length > 3 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">
                +{otherParticipants.length - 3}
              </div>
            )}
            <div>
              <h3 className="font-semibold">
                {conversation.title || otherParticipants.map((p) => p.full_name).join(", ")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {otherParticipants.length} participant{otherParticipants.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Info className="mr-2 h-4 w-4" />
                Conversation Details
              </DropdownMenuItem>
              <DropdownMenuItem>Search Messages</DropdownMenuItem>
              <DropdownMenuItem>Mute Notifications</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoadingMessages ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading messages...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {messagesData?.communications.map((message) => (
              <MessageBubble key={message.id} message={message} currentUserId={user?.id} />
            ))}
            {typers.size > 0 && <TypingIndicator count={typers.size} />}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Compose */}
      <div className="border-t p-4">
        <MessageCompose
          onSendMessage={handleSendMessage}
          isSending={sendMessage.isPending}
          onTypingChange={(isTyping: boolean) => sendTypingIndicator(conversationId, isTyping)}
          recipientUserIds={conversation.participant_ids}
          templateContext={{
            client_id: conversation.client_id,
            ...(conversation.title ? { client_name: conversation.title } : {}),
          }}
        />
      </div>
    </div>
  );
}
