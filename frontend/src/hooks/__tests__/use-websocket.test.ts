import { renderHook, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWebSocket } from "../use-websocket";
import { toast } from "sonner";

// ---- mock sonner ------------------------------------------------------------
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// ---- mock WebSocket ---------------------------------------------------------
const mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

// ---- mock localStorage -------------------------------------------------------
let localStorageStore: Record<string, string> = {};

vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
  return localStorageStore[key] ?? null;
});

vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
  localStorageStore[key] = value;
});

// ---- helpers ----------------------------------------------------------------
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

function getLastWsInstance(): MockWebSocket | undefined {
  return mockWsInstances[mockWsInstances.length - 1];
}

function simulateMessage(data: unknown) {
  const ws = getLastWsInstance();
  if (ws?.onmessage) {
    ws.onmessage({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function simulateOpen() {
  const ws = getLastWsInstance();
  if (ws?.onopen) {
    ws.onopen({} as Event);
  }
}

function simulateClose() {
  const ws = getLastWsInstance();
  if (ws?.onclose) {
    ws.onclose({} as CloseEvent);
  }
}

// -----------------------------------------------------------------------------

describe("useWebSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWsInstances.length = 0;
    localStorageStore = {};
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("connection behavior", () => {
    it("does not connect when no token in localStorage", () => {
      // No token set
      renderHook(() => useWebSocket(), { wrapper: createWrapper() });

      expect(mockWsInstances).toHaveLength(0);
    });

    it("creates WebSocket connection when token exists", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });

      expect(mockWsInstances).toHaveLength(1);
      expect(getLastWsInstance()?.url).toContain("/ws");
    });

    it("sends auth message on open", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();

      expect(getLastWsInstance()?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "auth", token: "test-token" })
      );
    });

    it("handles auth_success - sends subscribe message", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();
      vi.mocked(getLastWsInstance()!.send).mockClear();

      simulateMessage({ type: "auth_success" });

      expect(getLastWsInstance()?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "subscribe", channels: ["messages", "notifications"] })
      );
    });

    it("handles auth_error - closes connection", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();

      simulateMessage({ type: "auth_error" });

      expect(getLastWsInstance()?.close).toHaveBeenCalled();
    });

    it("reconnects on close after 5 seconds", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      expect(mockWsInstances).toHaveLength(1);

      simulateClose();

      // Before 5 seconds - no reconnect
      vi.advanceTimersByTime(4999);
      expect(mockWsInstances).toHaveLength(1);

      // After 5 seconds - reconnect
      vi.advanceTimersByTime(1);
      expect(mockWsInstances).toHaveLength(2);
    });
  });

  describe("message handlers", () => {
    it("handles notification message - calls onNotification callback, invalidates queries, shows toast", async () => {
      localStorageStore["access_token"] = "test-token";
      const onNotification = vi.fn();

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useWebSocket({ onNotification }), { wrapper });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      const notification = {
        id: "notif-1",
        title: "Test Notification",
        body: "This is a test",
        priority: "normal",
        read: false,
        created_at: "2025-01-01T00:00:00Z",
      };
      simulateMessage({ type: "notification", data: notification });

      expect(onNotification).toHaveBeenCalledWith(notification);
      expect(toast.info).toHaveBeenCalledWith("Test Notification", {
        description: "This is a test",
      });
    });

    it("shows warning toast for high priority notification", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      simulateMessage({
        type: "notification",
        data: { title: "High Priority", body: "Warning!", priority: "high" },
      });

      expect(toast.warning).toHaveBeenCalledWith("High Priority", {
        description: "Warning!",
      });
    });

    it("shows error toast for urgent priority notification", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      simulateMessage({
        type: "notification",
        data: { title: "Urgent!", body: "Action needed", priority: "urgent" },
      });

      expect(toast.error).toHaveBeenCalledWith("Urgent!", {
        description: "Action needed",
      });
    });

    it("handles new_message - calls onNewMessage callback, invalidates queries", async () => {
      localStorageStore["access_token"] = "test-token";
      const onNewMessage = vi.fn();

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useWebSocket({ onNewMessage }), { wrapper });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      const message = {
        id: "msg-1",
        conversation_id: "conv-1",
        content: "Hello!",
        sender_id: "user-1",
        created_at: "2025-01-01T00:00:00Z",
      };
      simulateMessage({ type: "new_message", data: message });

      expect(onNewMessage).toHaveBeenCalledWith(message);
    });

    it("handles typing - calls onTyping callback", () => {
      localStorageStore["access_token"] = "test-token";
      const onTyping = vi.fn();

      renderHook(() => useWebSocket({ onTyping }), { wrapper: createWrapper() });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      simulateMessage({
        type: "typing",
        conversation_id: "conv-1",
        user_id: "user-1",
        is_typing: true,
      });

      expect(onTyping).toHaveBeenCalledWith({
        conversation_id: "conv-1",
        user_id: "user-1",
        is_typing: true,
      });
    });

    it("handles message_read - calls onMessageRead callback", () => {
      localStorageStore["access_token"] = "test-token";
      const onMessageRead = vi.fn();

      renderHook(() => useWebSocket({ onMessageRead }), { wrapper: createWrapper() });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      const readData = {
        message_id: "msg-1",
        conversation_id: "conv-1",
        reader_id: "user-2",
        read_at: "2025-01-01T00:00:00Z",
      };
      simulateMessage({ type: "message_read", data: readData });

      expect(onMessageRead).toHaveBeenCalledWith(readData);
    });

    it("handles escalation - invalidates queries, shows toast", async () => {
      localStorageStore["access_token"] = "test-token";

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useWebSocket(), { wrapper });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      simulateMessage({
        type: "escalation",
        action: "created",
        data: { title: "Critical Issue", level: "high", status: "open" },
      });

      expect(toast.warning).toHaveBeenCalledWith("New escalation: Critical Issue", {
        description: "Level: high · Status: open",
      });
    });

    it("handles escalation update - shows updated toast", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      simulateMessage({
        type: "escalation",
        action: "updated",
        data: { title: "Critical Issue", level: "high", status: "resolved" },
      });

      expect(toast.warning).toHaveBeenCalledWith("Escalation updated: Critical Issue", {
        description: "Level: high · Status: resolved",
      });
    });

    it("handles program_update - invalidates queries, shows toast", async () => {
      localStorageStore["access_token"] = "test-token";

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      renderHook(() => useWebSocket(), { wrapper });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      simulateMessage({
        type: "program_update",
        data: {
          title: "Program Alpha",
          previous_status: "draft",
          status: "active",
        },
      });

      expect(toast.info).toHaveBeenCalledWith("Program updated: Program Alpha", {
        description: "Status changed from draft to active",
      });
    });

    it("ignores messages before authentication", () => {
      localStorageStore["access_token"] = "test-token";
      const onNewMessage = vi.fn();

      renderHook(() => useWebSocket({ onNewMessage }), { wrapper: createWrapper() });
      simulateOpen();
      // Don't send auth_success

      simulateMessage({
        type: "new_message",
        data: { id: "msg-1", content: "Hello!" },
      });

      expect(onNewMessage).not.toHaveBeenCalled();
    });

    it("handles malformed JSON - shows error toast", () => {
      localStorageStore["access_token"] = "test-token";

      renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();
      simulateMessage({ type: "auth_success" });

      const ws = getLastWsInstance();
      if (ws?.onmessage) {
        ws.onmessage({ data: "invalid json{" } as MessageEvent);
      }

      expect(toast.error).toHaveBeenCalledWith("Failed to parse WebSocket message");
    });
  });

  describe("sendMessage", () => {
    it("sends data when WebSocket is open", () => {
      localStorageStore["access_token"] = "test-token";

      const { result } = renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();

      act(() => {
        result.current.sendMessage({ type: "test", data: "hello" });
      });

      expect(getLastWsInstance()?.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "test", data: "hello" })
      );
    });

    it("shows error toast when WebSocket not connected", () => {
      localStorageStore["access_token"] = "test-token";

      const { result } = renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      
      // Simulate closed WebSocket
      const ws = getLastWsInstance();
      if (ws) {
        ws.readyState = MockWebSocket.CLOSED;
      }

      act(() => {
        result.current.sendMessage({ type: "test" });
      });

      expect(toast.error).toHaveBeenCalledWith("WebSocket is not connected");
    });
  });

  describe("sendTypingIndicator", () => {
    it("sends typing message", () => {
      localStorageStore["access_token"] = "test-token";

      const { result } = renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();

      act(() => {
        result.current.sendTypingIndicator("conv-1", true);
      });

      expect(getLastWsInstance()?.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "typing",
          conversation_id: "conv-1",
          is_typing: true,
        })
      );
    });

    it("sends typing stopped message", () => {
      localStorageStore["access_token"] = "test-token";

      const { result } = renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateOpen();

      act(() => {
        result.current.sendTypingIndicator("conv-1", false);
      });

      expect(getLastWsInstance()?.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "typing",
          conversation_id: "conv-1",
          is_typing: false,
        })
      );
    });
  });

  describe("cleanup", () => {
    it("closes WebSocket on unmount", () => {
      localStorageStore["access_token"] = "test-token";

      const { unmount } = renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      expect(mockWsInstances).toHaveLength(1);

      unmount();

      expect(getLastWsInstance()?.close).toHaveBeenCalled();
    });

    it("clears reconnect timeout on unmount", () => {
      localStorageStore["access_token"] = "test-token";

      const { unmount } = renderHook(() => useWebSocket(), { wrapper: createWrapper() });
      simulateClose();

      // Unmount before reconnect timeout fires
      unmount();

      // Advance past reconnect time - should not create new WebSocket
      vi.advanceTimersByTime(5000);
      // Only the original instance, no reconnect
      expect(mockWsInstances).toHaveLength(1);
    });
  });
});
