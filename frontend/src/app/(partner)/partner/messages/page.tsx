"use client";

import { useState } from "react";
import type { Conversation } from "@/types/communication";
import { ConversationList } from "@/components/communications/conversation-list";
import { ConversationView } from "@/components/communications/conversation-view";
import { MessageSquare } from "lucide-react";

export default function PartnerMessagesPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          Communicate with your AMG coordinators
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden rounded-lg border">
        {/* Sidebar - Conversation List */}
        <div className="w-80 border-r md:block">
          <ConversationList
            selectedId={selectedConversationId}
            onSelect={(conv: Conversation) => setSelectedConversationId(conv.id)}
          />
        </div>

        {/* Main - Conversation View */}
        <div className="flex-1">
          {selectedConversationId ? (
            <ConversationView
              conversationId={selectedConversationId}
              onBack={() => setSelectedConversationId(undefined)}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h2 className="mt-4 text-xl font-semibold">Select a conversation</h2>
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
