"use client";

import { useState } from "react";
import { useConversations } from "@/hooks/use-conversations";
import type { Conversation, ConversationListResponse } from "@/types/communication";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Users,
  Briefcase,
  Building,
} from "lucide-react";

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  /** Supply external data to bypass the default useConversations hook */
  conversations?: ConversationListResponse;
  isLoading?: boolean;
}

export function ConversationList({ selectedId, onSelect, conversations: externalData, isLoading: externalLoading }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const internal = useConversations(externalData ? undefined : { limit: 50 });
  const data = externalData ?? internal.data;
  const isLoading = externalLoading ?? internal.isLoading;

  const filteredConversations = data?.conversations.filter((conv) =>
    conv.title?.toLowerCase().includes(search.toLowerCase()) ||
    conv.participants.some((p) => p.full_name.toLowerCase().includes(search.toLowerCase()))
  ) ?? [];

  const getIcon = (type: string) => {
    switch (type) {
      case "rm_client":
        return <Users className="h-4 w-4" />;
      case "coordinator_partner":
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Building className="h-4 w-4" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="mb-2 text-lg font-semibold">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {search ? "No conversations found" : "No conversations yet"}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation)}
                className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50 ${
                  selectedId === conversation.id ? "bg-muted" : ""
                }`}
              >
                {/* Avatar/Icon */}
                <div className="relative">
                  {conversation.participants.length > 0 ? (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(conversation.participants[0]?.full_name || "??")}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      {getIcon(conversation.conversation_type)}
                    </div>
                  )}
                  {conversation.unread_count > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1 text-xs"
                    >
                      {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {conversation.title || conversation.participants[0]?.full_name || "New Conversation"}
                    </span>
                    {conversation.last_activity_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(conversation.last_activity_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {conversation.conversation_type === "rm_client"
                        ? "Client"
                        : conversation.conversation_type === "coordinator_partner"
                          ? "Partner"
                          : "Internal"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {conversation.participants.length} participant{conversation.participants.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
