import * as React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders } from "@/test/mocks/wrapper";
import { ConversationView } from "../conversation-view";
import type { Conversation, Communication } from "@/types/communication";

// ---- auth-provider ----------------------------------------------------------
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    user: { id: "user-1", full_name: "Test User", role: "rm" },
  }),
}));

// ---- websocket --------------------------------------------------------------
const mockSendTypingIndicator = vi.fn();
vi.mock("@/hooks/use-websocket", () => ({
  useWebSocket: () => ({ sendTypingIndicator: mockSendTypingIndicator }),
}));

// ---- conversation hooks -----------------------------------------------------
const mockMarkReadMutate = vi.fn();
const mockSendMessageMutate = vi.fn();

const sampleConversation: Conversation = {
  id: "conv-1",
  conversation_type: "rm_client",
  title: "Project Alpha",
  client_id: "client-1",
  participant_ids: ["user-1", "user-2"],
  participants: [
    { id: "user-1", full_name: "Test User", role: "rm" },
    { id: "user-2", full_name: "Jane Client", role: "client" },
  ],
  unread_count: 0,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const sampleMessages: Communication[] = [
  {
    id: "msg-1",
    conversation_id: "conv-1",
    channel: "in_portal",
    status: "delivered",
    sender_id: "user-1",
    sender_name: "Test User",
    body: "Hello, how are you?",
    approval_status: "draft",
    created_at: "2025-01-01T10:00:00Z",
    updated_at: "2025-01-01T10:00:00Z",
  },
  {
    id: "msg-2",
    conversation_id: "conv-1",
    channel: "in_portal",
    status: "delivered",
    sender_id: "user-2",
    sender_name: "Jane Client",
    body: "Doing great, thanks!",
    approval_status: "draft",
    created_at: "2025-01-01T10:01:00Z",
    updated_at: "2025-01-01T10:01:00Z",
  },
];

vi.mock("@/hooks/use-conversations", () => ({
  useConversation: () => ({
    data: sampleConversation,
    isLoading: false,
  }),
  useMessages: () => ({
    data: { communications: sampleMessages, total: 2 },
    isLoading: false,
  }),
  useSendMessage: () => ({
    mutate: mockSendMessageMutate,
    isPending: false,
  }),
  useMarkConversationRead: () => ({
    mutate: mockMarkReadMutate,
  }),
}));

// ---- message-compose: lightweight stub to avoid deep dependency tree --------
vi.mock("../message-compose", () => ({
  MessageCompose: ({
    onSendMessage,
    isSending,
  }: {
    onSendMessage: (body: string) => void;
    isSending: boolean;
  }) => (
    <div>
      <textarea data-testid="compose-input" />
      <button
        disabled={isSending}
        onClick={() => {
          const el = document.querySelector<HTMLTextAreaElement>(
            "[data-testid='compose-input']"
          );
          onSendMessage(el?.value ?? "");
        }}
      >
        Send
      </button>
    </div>
  ),
}));

// ---- message-bubble: lightweight stub ---------------------------------------
vi.mock("../message-bubble", () => ({
  MessageBubble: ({
    message,
  }: {
    message: Communication;
    currentUserId?: string;
  }) => <div data-testid={`message-${message.id}`}>{message.body}</div>,
}));

// ---- typing-indicator -------------------------------------------------------
vi.mock("../typing-indicator", () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}));

// -----------------------------------------------------------------------------

describe("ConversationView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the conversation title", () => {
    renderWithProviders(<ConversationView conversationId="conv-1" />);
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
  });

  it("renders participant count", () => {
    renderWithProviders(<ConversationView conversationId="conv-1" />);
    expect(screen.getByText(/2 participant/i)).toBeInTheDocument();
  });

  it("renders all messages in the conversation", () => {
    renderWithProviders(<ConversationView conversationId="conv-1" />);
    expect(screen.getByTestId("message-msg-1")).toHaveTextContent(
      "Hello, how are you?"
    );
    expect(screen.getByTestId("message-msg-2")).toHaveTextContent(
      "Doing great, thanks!"
    );
  });

  it("renders compose area", () => {
    renderWithProviders(<ConversationView conversationId="conv-1" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("calls sendMessage mutate when Send is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConversationView conversationId="conv-1" />);

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "A new message");
    await user.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(mockSendMessageMutate).toHaveBeenCalledWith({
        conversationId: "conv-1",
        data: { body: "A new message", attachment_ids: undefined },
      });
    });
  });

  it("marks conversation as read on mount", () => {
    renderWithProviders(<ConversationView conversationId="conv-1" />);
    expect(mockMarkReadMutate).toHaveBeenCalledWith("conv-1");
  });

  it("shows back button when onBack is provided", () => {
    const onBack = vi.fn();
    renderWithProviders(
      <ConversationView conversationId="conv-1" onBack={onBack} />
    );
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });
});
