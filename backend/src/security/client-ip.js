import { isIP } from "node:net";

const loopbackPeers = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function clientIp(request, { trustLoopbackProxy = false } = {}) {
  const peer = request.socket.remoteAddress || "";
  if (!trustLoopbackProxy || !loopbackPeers.has(peer)) return peer;

  const forwarded = request.headers["x-real-ip"];
  return typeof forwarded === "string" && isIP(forwarded) ? forwarded : peer;
}
