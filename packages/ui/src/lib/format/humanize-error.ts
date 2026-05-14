/**
 * Convert an unknown thrown value into a short, user-readable message suitable for a toast.
 * The bridge / pi / fs errors arrive in a variety of shapes — strings, `Error` instances,
 * RPC-style `{ code, message }`, plain objects. We keep the heuristics here so callers don't
 * sprinkle `instanceof` checks at every error boundary.
 */
export function humanizeError(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return cleanMessage(err.message) || fallback;
  if (typeof err === "object" && err !== null) {
    const e = err as { message?: unknown; code?: unknown; reason?: unknown };
    if (typeof e.message === "string" && e.message.length > 0) return cleanMessage(e.message);
    if (typeof e.reason === "string" && e.reason.length > 0) return cleanMessage(e.reason);
    if (typeof e.code === "string" && e.code.length > 0) return cleanMessage(e.code);
  }
  return fallback;
}

const NOISE_PREFIXES = [/^Error:\s+/i, /^TypeError:\s+/i, /^ProtocolError:\s+/i, /^RpcError:\s+/i];

function cleanMessage(raw: string): string {
  let msg = raw.trim();
  for (const re of NOISE_PREFIXES) msg = msg.replace(re, "");
  if (msg.length > 200) msg = `${msg.slice(0, 199)}…`;
  return msg;
}
