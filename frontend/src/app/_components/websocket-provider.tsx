/** biome-ignore-all lint/suspicious/noExplicitAny: ok to use any */
"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import useWebSocket, { type ReadyState } from "react-use-websocket";
import { GET_WS_URL } from "@/lib/api";

// Define the shape of a WebSocket message
interface WebSocketMessage {
  topic: string;
  payload: any;
}

// Define the type for the subscription callback
type SubscriptionCallback = (payload: any) => void;

// Define the shape of the WebSocket context
interface WebSocketContextType {
  subscribe: (topic: string, callback: SubscriptionCallback) => void;
  unsubscribe: (topic: string, callback: SubscriptionCallback) => void;
  readyState: ReadyState;
}

// Create the context
const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Custom hook to use the WebSocket context
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider",
    );
  }
  return context;
};

// WebSocketProvider component
export const WebSocketProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { sendMessage, lastMessage, readyState } = useWebSocket(GET_WS_URL(), {
    share: true, // Share the connection across components
    shouldReconnect: (_closeEvent) => true, // Automatically reconnect
  });
  const subscriptions = useRef<Map<string, Set<SubscriptionCallback>>>(
    new Map(),
  );

  useEffect(() => {
    if (lastMessage !== null) {
      try {
        const message = JSON.parse(lastMessage.data) as WebSocketMessage;
        const { topic, payload } = message;
        if (subscriptions.current.has(topic)) {
          subscriptions.current.get(topic)?.forEach((callback) => {
            callback(payload);
          });
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    }
  }, [lastMessage]);

  const subscribe = useCallback(
    (topic: string, callback: SubscriptionCallback) => {
      if (!subscriptions.current.has(topic)) {
        subscriptions.current.set(topic, new Set());
      }
      subscriptions.current.get(topic)?.add(callback);
      sendMessage(JSON.stringify({ type: "subscribe", topic }));
    },
    [sendMessage],
  );

  const unsubscribe = useCallback(
    (topic: string, callback: SubscriptionCallback) => {
      if (subscriptions.current.has(topic)) {
        subscriptions.current.get(topic)?.delete(callback);
        if (subscriptions.current.get(topic)?.size === 0) {
          subscriptions.current.delete(topic);
          sendMessage(JSON.stringify({ type: "unsubscribe", topic }));
        }
      }
    },
    [sendMessage],
  );

  const contextValue = {
    subscribe,
    unsubscribe,
    readyState,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
