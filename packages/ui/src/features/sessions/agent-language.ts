import { useLocaleStore } from "../../i18n/useLocaleStore.js";
import type { ProtocolClient } from "../../lib/transport/protocol-client.js";

/**
 * Push the global agent-language preference to the host.
 *
 * The preference lives in the renderer (`useLocaleStore`, set from Settings → Agents & Models and
 * — for `match-ui` — from Settings → Appearance → Language), but the agent runs host-side, so the
 * host has to be told. `session.setAgentLanguage` is the only channel the protocol offers and it
 * is per session; there is no global-default command. "One setting" is therefore implemented by
 * fanning the value out: on session create, on activate, and whenever either setting changes.
 *
 * `uiLocale` travels with the request because `match-ui` is collapsed into a concrete locale
 * host-side, in `resolveAgentLocale` — one place rather than every caller doing it differently.
 *
 * Deliberately a leaf: it takes the client and the ids rather than reaching into
 * `useSessionsStore`, which imports this module back for the create/activate hooks.
 */
export async function pushAgentLanguage(
  client: ProtocolClient,
  sessionIds: readonly string[],
): Promise<void> {
  if (sessionIds.length === 0) return;
  const { agentLanguage, uiLocale } = useLocaleStore.getState();
  // `allSettled`, and no toast: this is a background reconciliation, and a fan-out across every
  // open session would otherwise be able to raise one error per session for a single failure.
  // The preference itself is already persisted locally, and the next create/activate retries.
  await Promise.allSettled(
    sessionIds.map((sessionId) =>
      client.call("session.setAgentLanguage", { sessionId, language: agentLanguage, uiLocale }),
    ),
  );
}

/** Fan the preference out to every session the renderer knows about. */
export async function pushAgentLanguageToAll(
  client: ProtocolClient,
  sessions: readonly { id: string }[],
): Promise<void> {
  await pushAgentLanguage(
    client,
    sessions.map((s) => s.id),
  );
}
