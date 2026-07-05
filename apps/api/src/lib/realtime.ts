// Real-time "something changed" channel. The server broadcasts a tiny signal
// (not row data); clients react by refetching the whole trip. Keeping the
// fan-out pure and free of the DurableObject makes it unit-testable against
// fake sockets.

export type ChangedMessage = { type: "changed"; resource?: string };

/** The minimal surface `fanOut` needs from a socket. */
export interface Sendable {
  send(data: string): void;
  readyState: number;
}

// The numeric readyState for an open WebSocket (WebSocket.OPEN).
const OPEN = 1;

/**
 * Send `msg` to every socket, isolating a dead one so a single failure can't
 * abort the rest of the broadcast. Skips sockets that aren't OPEN.
 */
export function fanOut(sockets: Sendable[], msg: ChangedMessage): void {
  const payload = JSON.stringify(msg);
  for (const ws of sockets) {
    if (ws.readyState !== OPEN) continue;
    try {
      ws.send(payload);
    } catch {
      // A closed/errored socket shouldn't stop the fan-out.
    }
  }
}
