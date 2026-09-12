import { localizeHostErrorCode } from "../../i18n/host-errors";
import { ll } from "../../i18n/t";

/**
 * Convert an unknown thrown value into a short, user-readable message suitable for a toast.
 * The bridge / pi / fs errors arrive in a variety of shapes — strings, `Error` instances,
 * RPC-style `{ code, message }`, plain objects. We keep the heuristics here so callers don't
 * sprinkle `instanceof` checks at every error boundary.
 *
 * This is also the one place host errors get localized. A `HostError` from `ws-client.ts` (and any
 * RPC-shaped object) carries a stable `code`; when we recognise it, the translated string wins over
 * the host's English `message`. That costs a little specificity — "That item no longer exists."
 * instead of "Project abc123 not found" — and buys an app that is not half-English for everyone who
 * does not read English. Unrecognised codes fall through to the raw message untouched, which is the
 * right answer when a newer host meets an older renderer.
 */
export function humanizeError(err: unknown, fallback?: string): string {
  if (typeof err === "string") return err;

  const code = readCode(err);
  const localized = localizeHostErrorCode(code);
  if (localized) return localized;

  const resolvedFallback = fallback ?? ll().common.error.generic();
  if (err instanceof Error) return cleanMessage(err.message) || resolvedFallback;
  if (typeof err === "object" && err !== null) {
    const e = err as { message?: unknown; reason?: unknown };
    if (typeof e.message === "string" && e.message.length > 0) return cleanMessage(e.message);
    if (typeof e.reason === "string" && e.reason.length > 0) return cleanMessage(e.reason);
    if (code) return cleanMessage(code);
  }
  return resolvedFallback;
}

function readCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const { code } = err as { code?: unknown };
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

const NOISE_PREFIXES = [/^Error:\s+/i, /^TypeError:\s+/i, /^ProtocolError:\s+/i, /^RpcError:\s+/i];

/**
 * Node's `child_process.execFile` prepends its own `Command failed: <full command line>`
 * line to thrown errors. For git invocations that includes our `-c core.fsmonitor=false …`
 * shell flags, which is both noisy and pointless to surface to the user. Strip the entire
 * preamble (up to the first newline, or end of string if there isn't one) so the rest of
 * the message — the actual git diagnostic — can speak for itself.
 */
const COMMAND_FAILED_PREAMBLE = /^Command failed:[^\n]*\n?/;

function cleanMessage(raw: string): string {
  let msg = raw.trim();
  msg = msg.replace(COMMAND_FAILED_PREAMBLE, "");
  for (const re of NOISE_PREFIXES) msg = msg.replace(re, "");
  if (msg.length > 200) msg = `${msg.slice(0, 199)}…`;
  return msg.trim();
}
