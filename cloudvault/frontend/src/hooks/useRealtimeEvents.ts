import { useEffect, useRef, useCallback, useState } from "react";
import { RealtimeEvent } from "@/types";
import { getAccessToken } from "@/services/tokenStorage";

/**
 * Connects to CloudVault's realtime endpoint (/ws/{user_id}) and dispatches
 * typed events: upload_started, upload_progress, upload_completed,
 * file_processed, security_alert. Reconnects with backoff on drop.
 *
 * The backend requires a valid access token as a `?token=` query param
 * whose subject matches the path's user_id, checked before the socket is
 * accepted - a mismatched or missing token gets the connection closed
 * immediately. If the access token has expired since the last HTTP
 * request refreshed it, the socket will fail to connect and this hook's
 * backoff/retry loop will pick it up again shortly; it doesn't attempt an
 * inline token refresh itself.
 */
export function useRealtimeEvents(userId: string | null, onEvent: (evt: RealtimeEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!userId) return;

    const token = getAccessToken();
    if (!token) return; // not logged in (yet) - nothing to authenticate the socket with

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const base = import.meta.env.VITE_WS_BASE_URL ?? `${protocol}://${window.location.host}/ws`;
    const socket = new WebSocket(`${base}/${userId}?token=${encodeURIComponent(token)}`);

    socket.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
    };

    socket.onmessage = (msg) => {
      try {
        const parsed: RealtimeEvent = JSON.parse(msg.data);
        onEventRef.current(parsed);
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      setConnected(false);
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15_000);
      reconnectAttempt.current += 1;
      setTimeout(connect, delay);
    };

    socket.onerror = () => socket.close();

    wsRef.current = socket;
  }, [userId]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { connected };
}
