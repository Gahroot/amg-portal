import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthStore } from '@/lib/auth-store';
import { useNotificationStore } from '@/lib/notification-store';

const WS_RECONNECT_DELAY_BASE = 1000; // Start with 1 second
const WS_MAX_RECONNECT_DELAY = 30000; // Max 30 seconds
const WS_PING_INTERVAL = 30000; // Every 30 seconds

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const setWebSocketConnected = useNotificationStore(
    (s) => s.setWebSocketConnected,
  );
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_DELAY_BASE);
  const intentionalCloseRef = useRef(false);

  const getWsUrl = useCallback(() => {
    const apiUrl =
      process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
    return (
      apiUrl.replace('http://', 'ws://').replace('https://', 'wss://') +
      '/ws?token=' +
      token
    );
  }, [token]);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    intentionalCloseRef.current = false;
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setWebSocketConnected(true);
      reconnectDelayRef.current = WS_RECONNECT_DELAY_BASE;

      // Subscribe to notifications channel
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          channels: ['notifications'],
        }),
      );

      // Start heartbeat ping interval
      clearPingInterval();
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, WS_PING_INTERVAL);
    };

    ws.onmessage = (event: WebSocketMessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.type === 'notification') {
          incrementUnread();
        }
        // pong responses are silently consumed
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setWebSocketConnected(false);
      clearPingInterval();

      // Reconnect with exponential backoff unless intentionally closed
      if (!intentionalCloseRef.current && token) {
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
      // onclose will fire after onerror — reconnection is handled there
    };
  }, [
    token,
    getWsUrl,
    incrementUnread,
    setWebSocketConnected,
    clearPingInterval,
  ]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimeout();
    clearPingInterval();

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setWebSocketConnected(false);
  }, [setWebSocketConnected, clearReconnectTimeout, clearPingInterval]);

  const subscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'subscribe',
          channels: [channel],
        }),
      );
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'unsubscribe',
          channels: [channel],
        }),
      );
    }
  }, []);

  // Auto-connect when authenticated, auto-disconnect on logout
  useEffect(() => {
    if (token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Reconnect on app returning to foreground (handles network restore)
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && token) {
        // If the socket is not open, attempt reconnect
        if (
          !wsRef.current ||
          wsRef.current.readyState !== WebSocket.OPEN
        ) {
          reconnectDelayRef.current = WS_RECONNECT_DELAY_BASE;
          connect();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
    };
  }, [token, connect]);

  return {
    isConnected: useNotificationStore((s) => s.isWebSocketConnected),
    subscribe,
    unsubscribe,
    disconnect,
  };
}
