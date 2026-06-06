import type { TerminalShell } from "@pi-deck/core/protocol/commands.js";
import { useEffect, useState } from "react";
import { useSessionsStore } from "../sessions/useSessionsStore.js";

/**
 * Shells the host detected on this machine, plus the host's default path (the shell spawned when
 * the user hasn't picked one). Shared by the Settings → Terminal picker and the new-terminal
 * split-button menu.
 *
 * Detection costs a `where`/`which` spawn on the host and is stable for an app run, so the result
 * is cached at module scope and fetched once; every consumer/mount reuses it.
 */
export interface DetectedShells {
  shells: TerminalShell[];
  defaultPath: string | null;
}

const EMPTY: DetectedShells = { shells: [], defaultPath: null };

let cache: DetectedShells | null = null;
let inflight: Promise<DetectedShells> | null = null;

export function useDetectedShells(): DetectedShells {
  const client = useSessionsStore((s) => s.client);
  const [result, setResult] = useState<DetectedShells>(cache ?? EMPTY);

  useEffect(() => {
    if (cache) {
      setResult(cache);
      return;
    }
    if (!client) return;
    let cancelled = false;
    if (!inflight) {
      inflight = client.terminal
        .detectShells()
        .then((res) => {
          cache = { shells: res.shells, defaultPath: res.defaultPath };
          return cache;
        })
        .catch(() => {
          inflight = null; // let a later mount retry
          return EMPTY;
        });
    }
    void inflight.then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return result;
}
