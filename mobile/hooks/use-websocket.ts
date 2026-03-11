import { useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';

import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';

const WS_RECONNECT_DELAY_BASE = 1000; // Start with 1 second
const WS_MAX_RECONNECT_DELAY = 30000; // Max 30 seconds

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const setWebSocketConnected = useNotificationStore((s) => s.setWebSocketConnected);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_DELAY_BASE);

  const getWsUrl = useCallback(() => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
    return apiUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws?token=' + token;
  }, [token]);

  const connect = useCallback(() => {
    if (!token) {
      return;
    }

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWebSocketConnected(true);
      reconnectDelayRef.current = WS_RECONNECT_DELAY_BASE;

      // Subscribe to notifications channel
      ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['notifications'],
      }));

      // Send ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Every 30 seconds
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'notification') {
          incrementUnread();
          // Handle notification data
          // The navigation would be handled by the notification response handler
        } else if (data.type === 'pong') {
          // Pong response - ignore
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = (event) => {
      setWebSocketConnected(false);

      // Attempt to reconnect with exponential backoff
      if (token) {
        const delay = reconnectDelayRef.current;
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            WS_MAX_RECONNECT_DELAY
          );
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWebSocketConnected(false);
    };
  }, [token, getWsUrl, incrementUnread, setWebSocketConnected]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setWebSocketConnected(false);
  }, []);

  // Connect when authenticated
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Reconnect when network changes
  useEffect(() => {
    const handleOnline = () => {
      if (navigator.onLine && !wsRef.current) {
        connect();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [connect]);

  return {
    isConnected: useNotificationStore((s) => s.isWebSocketConnected),
    subscribe: (channel: string) => void {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          channels: [channel],
        }));
      }
    }
  },
  unsubscribe: (channel: string) => void {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'unsubscribe',
          channels: [channel],
        }));
      }
    }
  },
  disconnect,
};
