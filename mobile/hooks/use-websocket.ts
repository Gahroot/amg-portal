import { useCallback, useEffect, useRef } from 'react';

import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';

const WS_RECONNECT_DELAY_BASE = 1000;
const WS_MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const setWebSocketConnected = useNotificationStore((s) => s.setWebSocketConnected);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);
  const isConnected = useNotificationStore((s) => s.isWebSocketConnected);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_DELAY_BASE);

  const getWsUrl = useCallback(() => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
    return apiUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws?token=' + token;
  }, [token]);

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
  }, [setWebSocketConnected]);

  const connect = useCallback(() => {
    if (!token) return;

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWebSocketConnected(true);
      reconnectDelayRef.current = WS_RECONNECT_DELAY_BASE;
      ws.send(JSON.stringify({ type: 'subscribe', channels: ['notifications'] }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type: string };
        if (data.type === 'notification') {
          incrementUnread();
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setWebSocketConnected(false);
      if (token) {
        const delay = reconnectDelayRef.current;
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            WS_MAX_RECONNECT_DELAY,
          );
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      setWebSocketConnected(false);
    };
  }, [token, getWsUrl, incrementUnread, setWebSocketConnected]);

  useEffect(() => {
    if (token) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  const subscribe = useCallback(
    (channel: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'subscribe', channels: [channel] }));
      }
    },
    [],
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channels: [channel] }));
      }
    },
    [],
  );

  return { isConnected, subscribe, unsubscribe, disconnect };
}
