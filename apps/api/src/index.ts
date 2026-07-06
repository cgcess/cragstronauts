import { createApp } from "./app";
import type { Env } from "./types";
import { getTripDO } from "./do";
import { resolveAccountFromToken } from "./lib/auth";
import { decideTripAccess } from "./lib/access";

// /api/trips/<64hex>/ws — the per-trip real-time channel.
const WS_PATH = /^\/api\/trips\/([0-9a-f]{64})\/ws$/i;

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    // Intercept the WebSocket upgrade before Hono: browsers can't set an
    // Authorization header on `new WebSocket`, so we authenticate the token
    // from the subprotocol here and reuse the pure decideTripAccess gate.
    if (req.headers.get("Upgrade") === "websocket") {
      const res = await handleWsUpgrade(req, env);
      if (res) return res;
    }
    return createApp().fetch(req, env, ctx);
  },
};

async function handleWsUpgrade(req: Request, env: Env): Promise<Response | null> {
  const url = new URL(req.url);
  const match = url.pathname.match(WS_PATH);
  if (!match) return null;
  const tripId = match[1];

  const token = readWsToken(req, url);
  const accountId = await resolveAccountFromToken(env, token);

  let stub;
  try {
    stub = getTripDO(env, tripId);
  } catch {
    return new Response("Trip not found", { status: 404 });
  }

  const { isPublic } = await stub.getVisibility();
  const isMember = await stub.isMember(accountId);
  const decision = decideTripAccess({
    isPublic,
    signedIn: accountId !== null,
    isMember,
    action: "read-summary",
  });
  if (!decision.allow) {
    return new Response("Unauthorized", { status: decision.status });
  }

  return stub.fetch(req);
}

// The JWT rides in the WebSocket subprotocol (`clerktoken, <jwt>`) to keep it
// out of URLs and logs; a `?token=` query param is the documented fallback for
// proxies that strip the header.
function readWsToken(req: Request, url: URL): string | null {
  const proto = req.headers.get("Sec-WebSocket-Protocol");
  if (proto) {
    const parts = proto.split(",").map((s) => s.trim());
    const idx = parts.indexOf("clerktoken");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  }
  return url.searchParams.get("token");
}

export { TripDO } from "./TripDO";
export { TripIndexDO } from "./TripIndexDO";
export { AccountDO } from "./AccountDO";
