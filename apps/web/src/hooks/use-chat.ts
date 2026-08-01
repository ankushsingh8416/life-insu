"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { Socket } from "socket.io-client";
import {
  ChatMessage,
  ChatRole,
  Citation,
  ClientToServerEvents,
  MessageStatus,
  ServerToClientEvents,
} from "@sabsepehle/shared-types";
import { getChatSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";

interface ChatState {
  messages: ChatMessage[];
  connectionStatus: "connecting" | "connected" | "disconnected";
  isGenerating: boolean;
  error: string | null;
  /** Array index the next unseen streamed message should replace, set by regenerate(). */
  regenerationSlot: number | null;
}

type ChatAction =
  | { type: "HISTORY_LOADED"; messages: ChatMessage[] }
  | { type: "CONNECTION_STATUS"; status: ChatState["connectionStatus"] }
  | { type: "USER_MESSAGE_SENT"; message: ChatMessage }
  | { type: "REGENERATE_START"; targetMessageId: string }
  | { type: "STREAM_CITATIONS"; sessionId: string; messageId: string; citations: Citation[] }
  | { type: "STREAM_TOKEN"; sessionId: string; messageId: string; token: string }
  | { type: "STREAM_COMPLETE"; message: ChatMessage }
  | { type: "STREAM_ERROR"; messageId?: string; message: string }
  | { type: "CLEAR" };

function placeholderAssistantMessage(id: string, sessionId: string): ChatMessage {
  return {
    id,
    sessionId,
    role: ChatRole.ASSISTANT,
    content: "",
    citations: [],
    status: MessageStatus.STREAMING,
    confidenceScore: null,
    provider: null,
    model: null,
    language: null,
    tokensInput: null,
    tokensOutput: null,
    latencyMs: null,
    createdAt: new Date().toISOString(),
  };
}

function reducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "HISTORY_LOADED":
      return { ...state, messages: action.messages };

    case "CONNECTION_STATUS":
      return { ...state, connectionStatus: action.status };

    case "USER_MESSAGE_SENT":
      return { ...state, messages: [...state.messages, action.message], isGenerating: true, error: null };

    case "REGENERATE_START": {
      const index = state.messages.findIndex((m) => m.id === action.targetMessageId);
      if (index === -1) return { ...state, isGenerating: true, error: null };
      const messages = state.messages.filter((m) => m.id !== action.targetMessageId);
      return { ...state, messages, isGenerating: true, error: null, regenerationSlot: index };
    }

    case "STREAM_CITATIONS": {
      const exists = state.messages.some((m) => m.id === action.messageId);
      if (exists) {
        return {
          ...state,
          messages: state.messages.map((m) =>
            m.id === action.messageId ? { ...m, citations: action.citations } : m,
          ),
        };
      }
      // First event for this stream — create the placeholder now so citations
      // ("based on N sources") can render before any tokens arrive.
      const placeholder = {
        ...placeholderAssistantMessage(action.messageId, action.sessionId),
        citations: action.citations,
      };
      if (state.regenerationSlot !== null) {
        const messages = [...state.messages];
        messages.splice(state.regenerationSlot, 0, placeholder);
        return { ...state, messages, regenerationSlot: null };
      }
      return { ...state, messages: [...state.messages, placeholder] };
    }

    case "STREAM_TOKEN": {
      const exists = state.messages.some((m) => m.id === action.messageId);
      if (!exists) {
        const placeholder = placeholderAssistantMessage(action.messageId, action.sessionId);
        placeholder.content = action.token;
        if (state.regenerationSlot !== null) {
          const messages = [...state.messages];
          messages.splice(state.regenerationSlot, 0, placeholder);
          return { ...state, messages, regenerationSlot: null };
        }
        return { ...state, messages: [...state.messages, placeholder] };
      }
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.messageId ? { ...m, content: m.content + action.token } : m,
        ),
      };
    }

    case "STREAM_COMPLETE": {
      const exists = state.messages.some((m) => m.id === action.message.id);
      const messages = exists
        ? state.messages.map((m) => (m.id === action.message.id ? action.message : m))
        : [...state.messages, action.message];
      return { ...state, messages, isGenerating: false, regenerationSlot: null };
    }

    case "STREAM_ERROR": {
      const messages = action.messageId
        ? state.messages.map((m) =>
            m.id === action.messageId ? { ...m, status: MessageStatus.ERROR } : m,
          )
        : state.messages;
      return { ...state, messages, isGenerating: false, error: action.message, regenerationSlot: null };
    }

    case "CLEAR":
      return { ...state, messages: [], isGenerating: false, error: null, regenerationSlot: null };

    default:
      return state;
  }
}

export function useChat(sessionId: string | null, visitorId: string | null) {
  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    connectionStatus: "connecting",
    isGenerating: false,
    error: null,
    regenerationSlot: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    api
      .getHistory(sessionId)
      .then((result) => {
        if (!cancelled) dispatch({ type: "HISTORY_LOADED", messages: result.items });
      })
      .catch(() => {
        /* fresh session with no history yet — non-fatal */
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const socket = getChatSocket();
    socketRef.current = socket;

    const onConnect = () => {
      dispatch({ type: "CONNECTION_STATUS", status: "connected" });
      if (sessionIdRef.current) {
        socket.emit(ClientToServerEvents.JOIN_SESSION, { sessionId: sessionIdRef.current });
      }
    };
    const onDisconnect = () => dispatch({ type: "CONNECTION_STATUS", status: "disconnected" });

    const onCitations = (payload: { sessionId: string; messageId: string; citations: Citation[] }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      dispatch({
        type: "STREAM_CITATIONS",
        sessionId: payload.sessionId,
        messageId: payload.messageId,
        citations: payload.citations,
      });
    };
    const onToken = (payload: { sessionId: string; messageId: string; token: string }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      dispatch({
        type: "STREAM_TOKEN",
        sessionId: payload.sessionId,
        messageId: payload.messageId,
        token: payload.token,
      });
    };
    const onComplete = (payload: { sessionId: string; message: ChatMessage }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      dispatch({ type: "STREAM_COMPLETE", message: payload.message });
      trackEvent("conversation_finished", { sessionId: payload.sessionId });
    };
    const onError = (payload: { sessionId: string; messageId?: string; message: string }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      dispatch({ type: "STREAM_ERROR", messageId: payload.messageId, message: payload.message });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(ServerToClientEvents.CITATIONS, onCitations);
    socket.on(ServerToClientEvents.TOKEN, onToken);
    socket.on(ServerToClientEvents.MESSAGE_COMPLETE, onComplete);
    socket.on(ServerToClientEvents.ERROR, onError);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(ServerToClientEvents.CITATIONS, onCitations);
      socket.off(ServerToClientEvents.TOKEN, onToken);
      socket.off(ServerToClientEvents.MESSAGE_COMPLETE, onComplete);
      socket.off(ServerToClientEvents.ERROR, onError);
    };
  }, []);

  useEffect(() => {
    if (sessionId && socketRef.current?.connected) {
      socketRef.current.emit(ClientToServerEvents.JOIN_SESSION, { sessionId });
    }
  }, [sessionId]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!sessionId || !visitorId || !content.trim()) return;
      const socket = socketRef.current;
      if (!socket) return;

      const optimisticMessage: ChatMessage = {
        id: uuidv4(),
        sessionId,
        role: ChatRole.USER,
        content,
        citations: [],
        status: MessageStatus.COMPLETE,
        confidenceScore: null,
        provider: null,
        model: null,
        language: null,
        tokensInput: null,
        tokensOutput: null,
        latencyMs: null,
        createdAt: new Date().toISOString(),
      };

      dispatch({ type: "USER_MESSAGE_SENT", message: optimisticMessage });
      trackEvent("question_asked", { sessionId });
      socket.emit(ClientToServerEvents.SEND_MESSAGE, { sessionId, visitorId, content });
    },
    [sessionId, visitorId],
  );

  const regenerate = useCallback(
    (messageId: string) => {
      if (!sessionId) return;
      const socket = socketRef.current;
      if (!socket) return;
      dispatch({ type: "REGENERATE_START", targetMessageId: messageId });
      socket.emit(ClientToServerEvents.REGENERATE, { sessionId, messageId });
    },
    [sessionId],
  );

  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  return {
    messages: state.messages,
    connectionStatus: state.connectionStatus,
    isGenerating: state.isGenerating,
    error: state.error,
    sendMessage,
    regenerate,
    clear,
  };
}
