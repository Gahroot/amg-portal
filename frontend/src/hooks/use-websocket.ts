"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  WSMessage,
  WSNotificationMessage,
  WSTypingMessage,
  WSNewMessageMessage,
  Communication,
  Notification,
} from "@/types/communication";

interface UseWebSocketOptions {
  onNotification?: (notification: Notification) => void;
  onNewMessage?: (message: Communication) => void;
  onTyping?: (data: { conversation_id: string; user_id: string; is_typing: boolean }) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      // Subscribe to channels
      ws.send(JSON.stringify({
        type: "subscribe",
        channels: ["messages", "notifications"],
      }));
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current?.();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast.error("WebSocket connection error. Retrying...");
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);

        // Handle different message types
        if (message.type === "notification") {
          const notificationMsg = message as WSNotificationMessage;
          const currentOptions = optionsRef.current;
          if (currentOptions.onNotification) {
            currentOptions.onNotification(notificationMsg.data as Notification);
          }
          // Invalidate notifications query
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
        } else if (message.type === "new_message") {
          const msgMsg = message as WSNewMessageMessage;
          const currentOptions = optionsRef.current;
          if (currentOptions.onNewMessage) {
            currentOptions.onNewMessage(msgMsg.data as Communication);
          }
          // Invalidate messages and conversations queries
          queryClient.invalidateQueries({ queryKey: ["messages"] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
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
        }

        setMessages((prev) => [...prev, message]);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
        toast.error("Failed to parse WebSocket message");
      }
    };

    wsRef.current = ws;
  }, [queryClient]);

  const connectRef = useRef(connect);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

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

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    messages,
    sendMessage,
    sendTypingIndicator,
  };
}
