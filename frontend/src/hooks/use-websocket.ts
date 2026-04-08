
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import type {
  WSMessage,
  WSNotificationMessage,
  WSTypingMessage,
  WSNewMessageMessage,
  WSEscalationMessage,
  WSProgramUpdateMessage,
  Communication,
  Notification,
} from "@/types/communication";

interface ReadReceiptData {
  message_id: string;
  conversation_id: string;
  reader_id: string;
  read_at: string;
}

interface UseWebSocketOptions {
  onNotification?: (notification: Notification) => void;
  onNewMessage?: (message: Communication) => void;
  onTyping?: (data: { conversation_id: string; user_id: string; is_typing: boolean }) => void;
  onMessageRead?: (data: ReadReceiptData) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const connect = () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        // No auth token — don't attempt a WebSocket connection
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws";

      const ws = new WebSocket(wsUrl);
      let authenticated = false;

      ws.onopen = () => {
        // Send auth message with the token from localStorage
        ws.send(JSON.stringify({
          type: "auth",
          token,
        }));
      };

      ws.onclose = () => {
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        // Connection errors are expected when the backend is down.
        // The onclose handler will trigger automatic reconnection.
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          // Handle auth response
          if (message.type === "auth_success") {
            authenticated = true;
            // Subscribe to channels after successful auth
            ws.send(JSON.stringify({
              type: "subscribe",
              channels: ["messages", "notifications"],
            }));
            return;
          }

          if (message.type === "auth_error") {
            // Auth failed - close connection and don't reconnect
            ws.close();
            return;
          }

          // Only process other messages after authentication
          if (!authenticated) return;

          // Handle different message types
          if (message.type === "notification") {
            const notificationMsg = message as WSNotificationMessage;
            const notification = notificationMsg.data as Notification;
            const currentOptions = optionsRef.current;
            if (currentOptions.onNotification) {
              currentOptions.onNotification(notification);
            }
            // Invalidate notifications query
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
            // Show a toast for the incoming notification
            const toastFn =
              notification.priority === "urgent"
                ? toast.error
                : notification.priority === "high"
                  ? toast.warning
                  : toast.info;
            toastFn(notification.title, { description: notification.body });
          } else if (message.type === "new_message") {
            const msgMsg = message as WSNewMessageMessage;
            const currentOptions = optionsRef.current;
            if (currentOptions.onNewMessage) {
              currentOptions.onNewMessage(msgMsg.data as Communication);
            }
            // Invalidate messages and conversations queries
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
          } else if (message.type === "typing") {
            const typingMsg = message as WSTypingMessage;
            const currentOptions = optionsRef.current;
            if (currentOptions.onTyping) {
              currentOptions.onTyping({
                conversation_id: typingMsg.conversation_id,
                user_id: typingMsg.user_id,
                is_typing: typingMsg.is_typing,
              });
            }
          } else if (message.type === "message_read") {
            // Handle read receipts
            const readData = message.data as ReadReceiptData;
            const currentOptions = optionsRef.current;
            if (currentOptions.onMessageRead) {
              currentOptions.onMessageRead(readData);
            }
            // Invalidate messages to refresh read receipts
            queryClient.invalidateQueries({ queryKey: queryKeys.conversations.messagesAll(readData.conversation_id) });
          } else if (message.type === "escalation") {
            const escalationMsg = message as WSEscalationMessage;
            const action = escalationMsg.action;
            const data = escalationMsg.data;
            // Invalidate escalation queries to refresh lists and counts
            queryClient.invalidateQueries({ queryKey: queryKeys.escalations.all });
            // Show a toast for the escalation event
            const label = action === "created" ? "New escalation" : "Escalation updated";
            toast.warning(`${label}: ${data.title}`, {
              description: `Level: ${data.level} · Status: ${data.status}`,
            });
          } else if (message.type === "program_update") {
            const programMsg = message as WSProgramUpdateMessage;
            const data = programMsg.data;
            // Invalidate program queries for both dashboard and portal views
            queryClient.invalidateQueries({ queryKey: queryKeys.programs.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.portal.programs.all });
            // Show a toast for the status change
            toast.info(`Program updated: ${data.title}`, {
              description: `Status changed from ${data.previous_status} to ${data.status}`,
            });
          }
        } catch {
          // Malformed WebSocket messages are expected occasionally; user is notified via toast.
          toast.error("Failed to parse WebSocket message");
        }
      };

      wsRef.current = ws;
    };

    const disconnect = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    connect();
    return () => {
      disconnect();
    };
  }, [queryClient]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      toast.error("WebSocket is not connected");
    }
  }, []);

  const sendTypingIndicator = useCallback((conversationId: string, isTyping: boolean) => {
    sendMessage({
      type: "typing",
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }, [sendMessage]);

  return {
    sendMessage,
    sendTypingIndicator,
  };
}
