/**
 * useOfflineMessages - Hook for offline message composition and queuing
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { useOffline, useOfflineQueue } from './use-offline';
import { dataCache } from '@/services/DataCache';
import type { SendMessageData, Communication } from '@/types/communication';

const MESSAGE_QUEUE_KEY = 'offline_message_queue';
const DRAFT_KEY_PREFIX = 'message_draft_';

export interface QueuedMessage extends SendMessageData {
  id: string;
  queuedAt: number;
  retryCount: number;
}

export interface MessageDraft {
  conversationId?: string;
  body: string;
  savedAt: number;
}

/**
 * Hook for managing offline message queue
 */
export function useOfflineMessages() {
  const { isOffline, isOnline, wasOffline } = useOffline();
  const { getQueue, clearQueue } = useOfflineQueue<QueuedMessage>(MESSAGE_QUEUE_KEY);
  const [queuedCount, setQueuedCount] = useState(0);

  // Update queued count
  useEffect(() => {
    const updateCount = async () => {
      const queue = await getQueue();
      setQueuedCount(queue.length);
    };
    updateCount();
  }, [getQueue, isOnline]);

  /**
   * Queue a message for sending when online
   */
  const queueMessage = useCallback(
    async (message: SendMessageData): Promise<boolean> => {
      if (isOnline) {
        return false; // Don't queue, should send immediately
      }

      const queuedMessage: QueuedMessage = {
        ...message,
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        queuedAt: Date.now(),
        retryCount: 0,
      };

      const existingQueue = (await dataCache.get<QueuedMessage[]>(MESSAGE_QUEUE_KEY)) || [];
      await dataCache.set(MESSAGE_QUEUE_KEY, [...existingQueue, queuedMessage], 24 * 60 * 60 * 1000);

      setQueuedCount((prev) => prev + 1);

      Alert.alert(
        'Message Queued',
        'You are offline. Your message will be sent automatically when you are back online.',
        [{ text: 'OK' }]
      );

      return true;
    },
    [isOnline]
  );

  /**
   * Process queued messages when back online
   */
  const processQueue = useCallback(async (): Promise<{ sent: number; failed: number }> => {
    if (!isOnline) {
      return { sent: 0, failed: 0 };
    }

    const queue = await getQueue();
    if (queue.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const { sendMessage } = await import('@/lib/api/conversations');
    let sent = 0;
    let failed = 0;
    const remaining: QueuedMessage[] = [];

    for (const message of queue) {
      try {
        await sendMessage({
          conversation_id: message.conversation_id,
          body: message.body,
          attachment_ids: message.attachment_ids,
        });
        sent++;
      } catch (error) {
        console.error('Failed to send queued message:', error);
        // Keep message in queue if it hasn't exceeded retry limit
        if (message.retryCount < 3) {
          remaining.push({
            ...message,
            retryCount: message.retryCount + 1,
          });
        }
        failed++;
      }
    }

    // Update queue with remaining messages
    if (remaining.length > 0) {
      await dataCache.set(MESSAGE_QUEUE_KEY, remaining, 24 * 60 * 60 * 1000);
    } else {
      await clearQueue();
    }

    setQueuedCount(remaining.length);

    return { sent, failed };
  }, [isOnline, getQueue, clearQueue]);

  // Auto-process queue when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      processQueue();
    }
  }, [isOnline, wasOffline, processQueue]);

  return {
    isOffline,
    queuedCount,
    queueMessage,
    processQueue,
  };
}

/**
 * Hook for managing message drafts
 */
export function useMessageDraft(conversationId?: string) {
  const draftKey = conversationId ? `${DRAFT_KEY_PREFIX}${conversationId}` : `${DRAFT_KEY_PREFIX}new`;

  /**
   * Save draft
   */
  const saveDraft = useCallback(
    async (body: string) => {
      if (!body.trim()) {
        await dataCache.remove(draftKey);
        return;
      }

      const draft: MessageDraft = {
        conversationId,
        body,
        savedAt: Date.now(),
      };

      await dataCache.set(draftKey, draft, 24 * 60 * 60 * 1000); // 24 hours
    },
    [conversationId, draftKey]
  );

  /**
   * Load draft
   */
  const loadDraft = useCallback(async (): Promise<string> => {
    const draft = await dataCache.get<MessageDraft>(draftKey);
    return draft?.body || '';
  }, [draftKey]);

  /**
   * Clear draft
   */
  const clearDraft = useCallback(async () => {
    await dataCache.remove(draftKey);
  }, [draftKey]);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
  };
}

/**
 * Check if an action requires network
 */
export function useNetworkRequired() {
  const { isOffline } = useOffline();

  const checkNetwork = useCallback(
    (actionName: string = 'This action'): boolean => {
      if (isOffline) {
        Alert.alert(
          'No Connection',
          `${actionName} requires an internet connection. Please try again when you're online.`,
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    },
    [isOffline]
  );

  return { isOffline, checkNetwork };
}
