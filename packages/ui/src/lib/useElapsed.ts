import { useEffect, useState } from "react";

/**
 * Tick `Date.now() - startedAt` at ~4 Hz while `active` is true, so callers can render
 * "0.4s → 1.2s → …" without owning their own interval. When `active` flips false, the
 * returned value freezes at its last sampled point — the caller is expected to switch to
 * a static `endedAt - startedAt` once the underlying operation finishes.
 *
 * Used by the streaming `Thinking…` row and any running tool-call card to surface
 * elapsed-since-start to the user.
 */
export function useElapsed(startedAt: number | undefined, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || startedAt === undefined) return;
    // 250 ms keeps sub-second readouts (`0.4s` / `1.2s`) smooth without burning a high
    // tick rate on background tools the user can't currently see. The MessageList is
    // virtualized, so this interval only runs while the row is mounted.
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active, startedAt]);

  if (startedAt === undefined) return 0;
  return Math.max(0, now - startedAt);
}
