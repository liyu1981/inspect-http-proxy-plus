import { useEffect, useRef } from "react";
import { useWebSocketContext } from "../_components/websocket-provider";

export const useSubscription = <T>(
  topic: string,
  onMessage: (data: T) => void,
) => {
  const { subscribe, unsubscribe, readyState } = useWebSocketContext();

  // Use a ref to store the latest onMessage callback
  // This allows us to use the latest callback without triggering the useEffect
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const handler = (data: T) => {
      onMessageRef.current(data);
    };

    subscribe(topic, handler);
    return () => {
      unsubscribe(topic, handler);
    };
  }, [topic, subscribe, unsubscribe]);

  return { readyState };
};
