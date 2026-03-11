"use client";

import { useState } from "react";
import type { Conversation } from "@/types/communication";
import { ConversationList } from "@/components/communications/conversation-list";
import { ConversationView } from "@/components/communications/conversation-view";

export default function CommunicationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar - Conversation List */}
      <div className="w-80 border-r md:block">
        <ConversationList
          selectedId={selectedConversationId}
          onSelect={(conv) => setSelectedConversationId(conv.id)}
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
              <h2 className="text-xl font-semibold">Select a conversation</h2>
              <p className="text-muted-foreground">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
