import { useEffect } from "react";
import { useWebSocketContext } from "../_components/websocket-provider";

export const useSubscription = <T>(
  topic: string,
  onMessage: (data: T) => void,
) => {
  const { subscribe, unsubscribe, readyState } = useWebSocketContext();

  useEffect(() => {
    subscribe(topic, onMessage);
    return () => {
      unsubscribe(topic, onMessage);
    };
  }, [topic, onMessage, subscribe, unsubscribe]);

  return { readyState };
};
