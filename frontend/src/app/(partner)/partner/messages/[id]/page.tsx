"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { usePartnerConversation, usePartnerMessages, useSendPartnerMessage, useMarkPartnerConversationRead } from "@/hooks/use-partner-portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send } from "lucide-react";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getConversationTypeLabel(type: string) {
  switch (type) {
    case "rm_client": return "Client";
    case "coordinator_partner": return "Coordinator";
    default: return "Internal";
  }
}

export default function PartnerConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const [message, setMessage] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading: conversationLoading } = usePartnerConversation(conversationId);
  const { data: messagesData, isLoading: messagesLoading } = usePartnerMessages(conversationId);
  const sendMessage = useSendPartnerMessage();
  const markRead = useMarkPartnerConversationRead();

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({ conversationId, body: message.trim() }, { onSuccess: () => setMessage("") });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  React.useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markRead.mutate(conversationId);
    }
  }, [conversationId, conversation?.unread_count]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesData?.communications]);

  if (conversationLoading || messagesLoading) {
    return <div className="mx-auto max-w-4xl"><p className="text-muted-foreground text-sm">Loading conversation...</p></div>;
  }

  if (!conversation) {
    return <div className="mx-auto max-w-4xl"><p className="text-muted-foreground">Conversation not found.</p></div>;
  }

  const messages = messagesData?.communications ?? [];

  return (
    <div className="mx-auto max-w-4xl h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex items-center justify-between border-b pb-4 mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight">
              {conversation.title || conversation.participants[0]?.full_name || "Conversation"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{getConversationTypeLabel(conversation.conversation_type)}</Badge>
              <span className="text-xs text-muted-foreground">{conversation.participants.length} participant{conversation.participants.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 pb-4 border-b">
        <span className="text-sm text-muted-foreground">Participants:</span>
        <div className="flex items-center gap-2">
          {conversation.participants.map((p: any) => (
            <div key={p.id} className="flex items-center gap-1">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{getInitials(p.full_name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{p.full_name}</span>
              <Badge variant="secondary" className="text-xs">{p.role}</Badge>
            </div>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center py-12"><p className="text-muted-foreground">No messages yet. Start the conversation!</p></div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg: any) => {
              const isCurrentUser = !msg.sender_id;
              return (
                <div key={msg.id} className={"flex gap-3 " + (isCurrentUser ? "flex-row-reverse" : "")}>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className={"text-xs " + (isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {msg.sender_name ? getInitials(msg.sender_name) : isCurrentUser ? "You" : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className={"max-w-[70%] rounded-lg p-3 " + (isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {!isCurrentUser && msg.sender_name && <p className="text-xs font-medium mb-1">{msg.sender_name}</p>}
                    <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    <p className={"text-xs mt-1 " + (isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {msg.sent_at ? new Date(msg.sent_at).toLocaleString() : new Date(msg.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="border-t pt-4 mt-4">
        <div className="flex gap-2">
          <Input placeholder="Type your message..." value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown} className="flex-1" disabled={sendMessage.isPending} />
          <Button onClick={handleSend} disabled={!message.trim() || sendMessage.isPending}>
            <Send className="h-4 w-4" />
            {sendMessage.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
}
