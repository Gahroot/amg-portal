import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Paperclip, ArrowLeft, Users } from 'lucide-react-native';

import { VoiceInput } from '@/components/VoiceInput';
import { useOfflineMessages, useMessageDraft } from '@/hooks/use-offline-messages';
import { useOffline } from '@/hooks/use-offline';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import type { SpeechRecognitionLanguage } from '@/hooks/use-speech-to-text';

interface Message {
  id: string;
  body: string;
  sender_name: string;
  sender_role?: string;
  sent_at: string;
  is_own: boolean;
}

// Mock conversation for demonstration
const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    body: 'Welcome to partner communications. Use voice-to-text by tapping the microphone for quick note dictation.',
    sender_name: 'AMG Coordinator',
    sender_role: 'Relationship Manager',
    sent_at: new Date(Date.now() - 3600000).toISOString(),
    is_own: false,
  },
  {
    id: '2',
    body: 'Deliverable update: The client presentation has been completed and uploaded.',
    sender_name: 'You',
    sent_at: new Date(Date.now() - 1800000).toISOString(),
    is_own: true,
  },
];

export default function PartnerMessagesScreen() {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<SpeechRecognitionLanguage>('en-US');
  const [isSending, setIsSending] = useState(false);

  const { isOffline } = useOffline();
  const { queueMessage, queuedCount } = useOfflineMessages();
  const { saveDraft, loadDraft, clearDraft } = useMessageDraft('partner-conversation');

  // Load draft on mount
  useState(() => {
    loadDraft().then((draft) => {
      if (draft) setInputText(draft);
    });
  });

  const handleVoiceError = useCallback((error: string) => {
    console.log('Voice input error:', error);
  }, []);

  const handleRecordingEnd = useCallback((transcript: string) => {
    console.log('Voice recording ended, transcript length:', transcript.length);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    const messageBody = inputText.trim();
    setIsSending(true);

    try {
      if (isOffline) {
        await queueMessage({
          body: messageBody,
        });
        setInputText('');
        await clearDraft();
      } else {
        const newMessage: Message = {
          id: `msg_${Date.now()}`,
          body: messageBody,
          sender_name: 'You',
          sent_at: new Date().toISOString(),
          is_own: true,
        };

        setMessages((prev) => [...prev, newMessage]);
        setInputText('');
        await clearDraft();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [inputText, isOffline, queueMessage, clearDraft]);

  const handleTextChange = useCallback(async (text: string) => {
    setInputText(text);
    await saveDraft(text);
  }, [saveDraft]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View className="border-b border-border px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Pressable className="mr-3">
                <ArrowLeft color="#64748b" size={24} />
              </Pressable>
              <View>
                <Text className="text-lg font-semibold text-foreground">Messages</Text>
                <View className="flex-row items-center gap-1">
                  <Users color="#64748b" size={12} />
                  <Text className="text-sm text-muted-foreground">AMG Coordination Team</Text>
                </View>
              </View>
            </View>
            {queuedCount > 0 && (
              <View className="rounded-full bg-orange-100 px-3 py-1">
                <Text className="text-sm font-medium text-orange-700">
                  {queuedCount} queued
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Offline Indicator */}
        {isOffline && <OfflineIndicator />}

        {/* Messages List */}
        <ScrollView
          className="flex-1 px-4 py-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              className={`mb-3 max-w-[85%] rounded-2xl px-4 py-3 ${
                message.is_own
                  ? 'self-end bg-primary'
                  : 'self-start bg-card border border-border'
              }`}
            >
              {!message.is_own && message.sender_role && (
                <Text className="mb-1 text-xs font-medium text-primary">
                  {message.sender_role}
                </Text>
              )}
              <Text
                className={`text-base ${
                  message.is_own ? 'text-primary-foreground' : 'text-foreground'
                }`}
              >
                {message.body}
              </Text>
              <Text
                className={`mt-1 text-xs ${
                  message.is_own ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}
              >
                {message.sender_name} • {new Date(message.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Input Area */}
        <View className="border-t border-border px-4 py-3">
          <View className="flex-row items-end gap-2">
            <VoiceInput
              value={inputText}
              onChangeText={handleTextChange}
              language={selectedLanguage}
              placeholder="Type or dictate a message..."
              multiline={true}
              numberOfLines={3}
              onRecordingEnd={handleRecordingEnd}
              onError={handleVoiceError}
              containerClassName="flex-1"
              inputClassName="pr-2"
            />

            {/* Attachment Button */}
            <Pressable
              className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              onPress={() => Alert.alert('Attachments', 'File attachment coming soon!')}
            >
              <Paperclip color="#64748b" size={20} />
            </Pressable>

            {/* Send Button */}
            <Pressable
              className={`mb-2 h-10 w-10 items-center justify-center rounded-full ${
                inputText.trim() ? 'bg-primary' : 'bg-slate-100'
              }`}
              onPress={handleSendMessage}
              disabled={!inputText.trim() || isSending}
            >
              <Send
                color={inputText.trim() ? '#ffffff' : '#94a3b8'}
                size={20}
              />
            </Pressable>
          </View>

          {/* Voice Input Hint */}
          <Text className="mt-2 text-center text-xs text-muted-foreground">
            Tap the microphone to dictate your message
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
