"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConversationList } from "@/components/communications/conversation-list";
import { ConversationView } from "@/components/communications/conversation-view";
import { TemplateCompose } from "@/components/communications/template-compose";
import { DraftList } from "@/components/communications/draft-list";
import { ReviewQueue } from "@/components/communications/review-queue";
import { useUsers } from "@/hooks/use-users";
import { useCommunicationsByStatus } from "@/hooks/use-communication-approvals";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import type { Communication } from "@/types/communication";
import { API_BASE_URL } from "@/lib/constants";

const SENT_EXPORT_COLUMNS: ExportColumn<Communication>[] = [
  { header: "Subject", accessor: (r) => r.subject ?? "(No subject)" },
  { header: "Channel", accessor: "channel" },
  { header: "Sender", accessor: (r) => r.sender_name ?? "" },
  { header: "Sent At", accessor: (r) => r.sent_at ? new Date(r.sent_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString() },
  { header: "Status", accessor: "status" },
];

export default function CommunicationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("messages");

  const { data: usersData } = useUsers({ limit: 100 });
  const users = usersData?.users ?? [];

  const { data: sentData } = useCommunicationsByStatus("sent");
  const sentCommunications = sentData?.communications ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Tabs header */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="border-b px-4">
          <TabsList>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
            <TabsTrigger value="pending-review">Pending Review</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
          </TabsList>
        </div>

        {/* Messages tab - original two-pane layout */}
        <TabsContent value="messages" className="flex-1 min-h-0 mt-0">
          <div className="flex h-full">
            {/* Sidebar - Conversation List */}
            <div className="w-80 border-r md:block">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="font-semibold">Messages</h2>
                <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Compose
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Compose with Template</DialogTitle>
                      <DialogDescription>
                        Choose a template, fill in the variables, preview, and send to a recipient.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="recipient-select">Recipient</Label>
                        <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                          <SelectTrigger id="recipient-select">
                            <SelectValue placeholder="Choose a recipient…" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.full_name} ({u.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <TemplateCompose
                        recipientUserIds={selectedRecipientId ? [selectedRecipientId] : []}
                        onSent={() => {
                          setIsComposeOpen(false);
                          setSelectedRecipientId("");
                        }}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Select a conversation</h2>
                    <p className="text-muted-foreground">
                      Choose a conversation from the list to start messaging
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-1.5"
                      onClick={() => setIsComposeOpen(true)}
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Compose with Template
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Drafts tab */}
        <TabsContent value="drafts" className="flex-1 min-h-0 mt-0 overflow-auto">
          <div className="max-w-4xl mx-auto py-4">
            <DraftList />
          </div>
        </TabsContent>

        {/* Pending Review tab */}
        <TabsContent value="pending-review" className="flex-1 min-h-0 mt-0 overflow-auto">
          <div className="max-w-4xl mx-auto py-4">
            <ReviewQueue />
          </div>
        </TabsContent>

        {/* Sent tab */}
        <TabsContent value="sent" className="flex-1 min-h-0 mt-0 overflow-auto">
          <div className="max-w-4xl mx-auto py-4">
            {sentCommunications.length > 0 && (
              <div className="flex justify-end mb-3">
                <DataTableExport
                  visibleRows={sentCommunications}
                  columns={SENT_EXPORT_COLUMNS}
                  fileName="sent-communications"
                  exportAllUrl={`${API_BASE_URL}/api/v1/export/communications?status=sent`}
                />
              </div>
            )}
            {sentCommunications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="font-medium text-lg">No sent communications</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Approved and sent communications will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {sentCommunications.map((comm) => (
                  <div key={comm.id} className="flex items-start gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {comm.subject || "(No subject)"}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {comm.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sent {comm.sent_at ? new Date(comm.sent_at).toLocaleDateString() : new Date(comm.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
