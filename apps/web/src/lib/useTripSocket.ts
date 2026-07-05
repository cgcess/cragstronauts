import { useEffect, useRef } from "react";
import { getAuthToken } from "../api";

// Capped exponential backoff for reconnects: 1s, 2s, 4s, … up to 30s.
export function nextBackoff(attempt: number): number {
  const base = 1000;
  const max = 30000;
  return Math.min(max, base * 2 ** attempt);
}

// A trailing debounce: a burst of calls collapses to one invocation `ms` after
// the last call. Returned as pure functions so the timing is unit-testable.
export function makeDebounce(
  fn: () => void,
  ms: number
): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

function wsUrl(tripId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/trips/${tripId}/ws`;
}

/**
 * Subscribe to a trip's real-time "changed" channel. On every change signal it
 * calls `onChange` (debounced), which the caller wires to a full refetch. Auth
 * is connect-time only: a fresh token is fetched per (re)connect attempt.
 */
export function useTripSocket(
  tripId: string,
  enabled: boolean,
  onChange: () => void
) {
  // Keep the latest onChange without re-running the connect effect.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !tripId) return;

    let closed = false;
    let ws: WebSocket | null = null;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const debounced = makeDebounce(() => onChangeRef.current(), 250);

    const clearHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer) return;
      const delay = nextBackoff(attempt++);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (closed) return;
      // Fresh token each attempt — an expired one never reaches new WebSocket.
      const token = await getAuthToken();
      if (closed) return;

      let socket: WebSocket;
      try {
        socket = new WebSocket(
          wsUrl(tripId),
          token ? ["clerktoken", token] : undefined
        );
      } catch {
        scheduleReconnect();
        return;
      }
      ws = socket;

      socket.onopen = () => {
        attempt = 0;
        clearHeartbeat();
        heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 30000);
      };
      socket.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          if (data && data.type === "changed") debounced.call();
        } catch {
          // Non-JSON frames (e.g. the "pong" heartbeat) are ignored.
        }
      };
      socket.onclose = () => {
        clearHeartbeat();
        if (ws === socket) ws = null;
        scheduleReconnect();
      };
      socket.onerror = () => {
        try {
          socket.close();
        } catch {
          // onclose will handle the reconnect.
        }
      };
    };

    void connect();

    return () => {
      closed = true;
      debounced.cancel();
      clearHeartbeat();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // Already closing.
        }
      }
    };
  }, [tripId, enabled]);
}
