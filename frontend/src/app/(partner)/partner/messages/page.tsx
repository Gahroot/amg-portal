"use client";

import { useState } from "react";
import type { Conversation } from "@/types/communication";
import {
  usePartnerConversations,
  usePartnerConversation,
  usePartnerMessages,
  useSendPartnerMessageForView,
  useMarkPartnerConversationRead,
} from "@/hooks/use-partner-portal";
import { ConversationList } from "@/components/communications/conversation-list";
import { ConversationView } from "@/components/communications/conversation-view";
import type { InboxFilter, InboxTypeFilter } from "@/components/communications/inbox-filter-bar";
import { MessageSquare } from "lucide-react";

function PartnerConversationView({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const { data: conversation, isLoading: isLoadingConversation } =
    usePartnerConversation(conversationId);
  const { data: messagesData, isLoading: isLoadingMessages } =
    usePartnerMessages(conversationId, { limit: 100 });
  const sendMessage = useSendPartnerMessageForView();
  const markRead = useMarkPartnerConversationRead();

  return (
    <ConversationView
      conversationId={conversationId}
      onBack={onBack}
      overrides={{
        conversation,
        isLoadingConversation,
        messagesData,
        isLoadingMessages,
        sendMessage,
        markRead,
      }}
    />
  );
}

export default function PartnerMessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | undefined
  >();
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [activeTypeFilter, setActiveTypeFilter] = useState<InboxTypeFilter>("all");
  const { data, isLoading } = usePartnerConversations({ limit: 50 });

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          Communicate with your coordinators about assignments and deliverables
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-lg border">
        {/* Sidebar - Conversation List */}
        <div className="w-80 border-r md:block">
          <ConversationList
            selectedId={selectedConversationId}
            onSelect={(conv: Conversation) =>
              setSelectedConversationId(conv.id)
            }
            conversations={data}
            isLoading={isLoading}
            showFilterBar={true}
            activeFilter={activeFilter}
            activeTypeFilter={activeTypeFilter}
            onFilterChange={setActiveFilter}
            onTypeFilterChange={setActiveTypeFilter}
          />
        </div>

        {/* Main - Conversation View */}
        <div className="flex-1">
          {selectedConversationId ? (
            <PartnerConversationView
              conversationId={selectedConversationId}
              onBack={() => setSelectedConversationId(undefined)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-xl font-semibold">
                  Select a conversation
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
