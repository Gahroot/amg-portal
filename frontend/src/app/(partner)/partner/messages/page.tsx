"use client";

import * as React from "react";
import Link from "next/link";
import { usePartnerConversations } from "@/hooks/use-partner-portal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Search, Briefcase, Users, Building } from "lucide-react";
import type { Conversation, ParticipantInfo } from "@/types/communication";

function filterConversations(conversations: Conversation[], search: string) {
  if (!conversations) return [];
  if (!search) return conversations;
  const searchLower = search.toLowerCase();
  return conversations.filter((conv) =>
    conv.title?.toLowerCase().includes(searchLower) ||
    conv.participants.some((p: ParticipantInfo) => p.full_name.toLowerCase().includes(searchLower))
  );
}

function getIcon(type: string) {
  switch (type) {
    case "rm_client": return <Users className="h-4 w-4" />;
    case "coordinator_partner": return <Briefcase className="h-4 w-4" />;
    default: return <Building className="h-4 w-4" />;
  }
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function PartnerMessagesPage() {
  const [search, setSearch] = React.useState("");
  const { data, isLoading } = usePartnerConversations({ limit: 50 });

  const filtered = filterConversations(data?.conversations || [], search);
  const totalUnread = data?.conversations.reduce((sum: number, c: Conversation) => sum + c.unread_count, 0) ?? 0;

  if (isLoading) {
    return <div className="mx-auto max-w-5xl"><p className="text-muted-foreground text-sm">Loading conversations...</p></div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">Communicate with your coordinators about assignments and deliverables</p>
        </div>
        {totalUnread > 0 && <Badge variant="destructive" className="text-sm">{totalUnread} unread message{totalUnread !== 1 ? "s" : ""}</Badge>}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
            <p className="text-sm text-muted-foreground">Conversations with your coordinators will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((conversation: Conversation) => (
            <Link key={conversation.id} href={"/partner/messages/" + conversation.id} className="block">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      {conversation.participants.length > 0 ? (
                        <Avatar className="h-12 w-12">
                          <AvatarImage src="" />
                          <AvatarFallback className="bg-primary/10 text-primary">{getInitials(conversation.participants[0]?.full_name || "??")}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">{getIcon(conversation.conversation_type)}</div>
                      )}
                      {conversation.unread_count > 0 && (
                        <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full px-1.5 text-xs">
                          {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                        </Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{conversation.title || conversation.participants[0]?.full_name || "New Conversation"}</span>
                        {conversation.last_activity_at && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(conversation.last_activity_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {conversation.conversation_type === "rm_client" ? "Client" : conversation.conversation_type === "coordinator_partner" ? "Coordinator" : "Internal"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{conversation.participants.length} participant{conversation.participants.length !== 1 ? "s" : ""}</span>
                      </div>
                      {conversation.unread_count > 0 && (
                        <p className="text-xs text-primary mt-1">{conversation.unread_count} new message{conversation.unread_count !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {data && <p className="text-sm text-muted-foreground">{data.total} conversation{data.total !== 1 ? "s" : ""} total</p>}
    </div>
  );
}
