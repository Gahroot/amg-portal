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
import { useCreateConversation, useSendMessage } from "@/hooks/use-conversations";
import { useAuth } from "@/providers/auth-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Send, Loader2 } from "lucide-react";
import { DataTableExport } from "@/components/ui/data-table-export";
import type { ExportColumn } from "@/lib/export-utils";
import type { Communication, ConversationType } from "@/types/communication";
import { API_BASE_URL } from "@/lib/constants";
import { toast } from "sonner";

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
  const [composeMode, setComposeMode] = useState<"freeform" | "template">("freeform");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeConvType, setComposeConvType] = useState<ConversationType>("internal");

  const { user } = useAuth();
  const { data: usersData } = useUsers({ limit: 100 });
  const users = usersData?.users ?? [];
  const createConversation = useCreateConversation();
  const sendMessageMutation = useSendMessage();

  const { data: sentData } = useCommunicationsByStatus("sent");
  const sentCommunications = sentData?.communications ?? [];

  const isSendingFreeform = createConversation.isPending || sendMessageMutation.isPending;

  const handleFreeformSend = async () => {
    if (!selectedRecipientId || !composeBody.trim()) return;

    try {
      const participantIds = [selectedRecipientId];
      if (user?.id && !participantIds.includes(user.id)) {
        participantIds.push(user.id);
      }

      const conversation = await createConversation.mutateAsync({
        conversation_type: composeConvType,
        title: composeTitle.trim() || undefined,
        participant_ids: participantIds,
      });

      await sendMessageMutation.mutateAsync({
        conversationId: conversation.id,
        data: { body: composeBody },
      });

      setSelectedConversationId(conversation.id);
      resetComposeForm();
      setIsComposeOpen(false);
      toast.success("Message sent");
    } catch {
      // Error toasts are handled by the mutation hooks
    }
  };

  const resetComposeForm = () => {
    setSelectedRecipientId("");
    setComposeTitle("");
    setComposeBody("");
    setComposeConvType("internal");
    setComposeMode("freeform");
  };

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
                      <DialogTitle>New Message</DialogTitle>
                      <DialogDescription>
                        Send a free-form message or use a template.
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs value={composeMode} onValueChange={(v) => setComposeMode(v as "freeform" | "template")}>
                      <TabsList className="mb-3 h-8">
                        <TabsTrigger value="freeform" className="text-xs px-3 py-1">
                          Free-form
                        </TabsTrigger>
                        <TabsTrigger value="template" className="text-xs px-3 py-1">
                          Use Template
                        </TabsTrigger>
                      </TabsList>

                      {/* Free-form compose */}
                      <TabsContent value="freeform" className="mt-0 space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="ff-recipient">Recipient</Label>
                          <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                            <SelectTrigger id="ff-recipient">
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
                        <div className="space-y-1.5">
                          <Label htmlFor="ff-conv-type">Conversation Type</Label>
                          <Select value={composeConvType} onValueChange={(v) => setComposeConvType(v as ConversationType)}>
                            <SelectTrigger id="ff-conv-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="internal">Internal</SelectItem>
                              <SelectItem value="rm_client">Client</SelectItem>
                              <SelectItem value="coordinator_partner">Partner</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ff-title">Subject <span className="text-muted-foreground text-xs">(optional)</span></Label>
                          <Input
                            id="ff-title"
                            placeholder="Conversation subject…"
                            value={composeTitle}
                            onChange={(e) => setComposeTitle(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="ff-body">Message</Label>
                          <Textarea
                            id="ff-body"
                            placeholder="Type your message…"
                            value={composeBody}
                            onChange={(e) => setComposeBody(e.target.value)}
                            rows={4}
                            className="resize-none"
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={handleFreeformSend}
                            disabled={isSendingFreeform || !selectedRecipientId || !composeBody.trim()}
                          >
                            {isSendingFreeform ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="mr-2 h-3.5 w-3.5" />
                            )}
                            Send
                          </Button>
                        </div>
                      </TabsContent>

                      {/* Template compose */}
                      <TabsContent value="template" className="mt-0 space-y-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="tpl-recipient">Recipient</Label>
                          <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                            <SelectTrigger id="tpl-recipient">
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
                            resetComposeForm();
                            setIsComposeOpen(false);
                          }}
                        />
                      </TabsContent>
                    </Tabs>
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
                      New Message
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
