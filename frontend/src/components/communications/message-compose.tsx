"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import {
  Paperclip,
  Send,
  X,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Mic,
} from "lucide-react";
import { TemplateCompose } from "./template-compose";
import { ClientPreferenceCard } from "@/components/clients/client-preference-card";
import { VoiceRecorder } from "./voice-recorder";

interface TemplateContext {
  client_name?: string;
  program_title?: string;
  rm_name?: string;
  client_id?: string;
  program_id?: string;
  [key: string]: string | undefined;
}

interface MessageComposeProps {
  onSendMessage: (body: string, attachmentIds?: string[]) => void;
  isSending?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
  /** User IDs of conversation participants (used for template send recipients) */
  recipientUserIds?: string[];
  /** Context for auto-filling template variables */
  templateContext?: TemplateContext;
  /** When provided, shows a compact preference card above the compose area */
  clientId?: string;
}

export function MessageCompose({
  onSendMessage,
  isSending,
  onTypingChange,
  recipientUserIds = [],
  templateContext = {},
  clientId,
}: MessageComposeProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  const wrapSelection = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    const newText = message.substring(0, start) + prefix + selectedText + suffix + message.substring(end);
    setMessage(newText);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const handleBold = () => wrapSelection("**");
  const handleItalic = () => wrapSelection("_");
  const handleLink = () => wrapSelection("[", "](url)");
  const handleList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    const lines = selectedText.split("\n");
    const listText = lines.map((line) => `- ${line}`).join("\n");
    const newText = message.substring(0, start) + listText + message.substring(end);
    setMessage(newText);
  };
  const handleOrderedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    const lines = selectedText.split("\n");
    const listText = lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
    const newText = message.substring(0, start) + listText + message.substring(end);
    setMessage(newText);
  };

  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;

    onSendMessage(message, []);
    setMessage("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (value: string) => {
    setMessage(value);
    onTypingChange?.(value.length > 0);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVoiceRecordingComplete = (objectPath: string) => {
    // Send immediately as a voice message with the audio object path encoded in attachment_ids
    onSendMessage("🎙️ Voice message", [`voice:${objectPath}`]);
    setShowVoiceRecorder(false);
  };

  return (
    <div className="w-full space-y-3">
      {clientId && (
        <ClientPreferenceCard clientId={clientId} compact />
      )}
    <Tabs defaultValue="freeform" className="w-full">
      <TabsList className="mb-2 h-8">
        <TabsTrigger value="freeform" className="text-xs px-3 py-1">
          Free-form
        </TabsTrigger>
        <TabsTrigger value="template" className="text-xs px-3 py-1">
          Use Template
        </TabsTrigger>
      </TabsList>

      {/* Free-form compose */}
      <TabsContent value="freeform" className="space-y-2 mt-0">
        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1 border-b pb-2">
          <Toggle size="sm" onPressedChange={handleBold} aria-label="Bold">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" onPressedChange={handleItalic} aria-label="Italic">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" onPressedChange={handleLink} aria-label="Link">
            <LinkIcon className="h-4 w-4" />
          </Toggle>
          <div className="mx-1 h-4 w-px bg-border" />
          <Toggle size="sm" onPressedChange={handleList} aria-label="Bullet list">
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle size="sm" onPressedChange={handleOrderedList} aria-label="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </Toggle>
          <div className="mx-1 h-4 w-px bg-border" />
          <Toggle
            size="sm"
            pressed={showVoiceRecorder}
            onPressedChange={(p) => setShowVoiceRecorder(p)}
            aria-label="Voice message"
            disabled={isSending}
          >
            <Mic className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Voice recorder */}
        {showVoiceRecorder && (
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecordingComplete}
            onCancel={() => setShowVoiceRecorder(false)}
            disabled={isSending}
          />
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-sm"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={() => removeAttachment(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        {!showVoiceRecorder && (
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              placeholder="Type a message… (supports **bold**, _italic_, [links](url))"
              value={message}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              rows={1}
              className="min-h-[40px] max-h-[200px] resize-none"
            />
            <Button
              onClick={handleSend}
              disabled={isSending || (!message.trim() && attachments.length === 0)}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </TabsContent>

      {/* Template compose */}
      <TabsContent value="template" className="mt-0">
        <TemplateCompose
          recipientUserIds={recipientUserIds}
          context={templateContext}
        />
      </TabsContent>
    </Tabs>
    </div>
  );
}
