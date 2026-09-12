/**
 * The locale vocabulary shared by the host, the worker and the renderer.
 *
 * `packages/core` deliberately ships **no message catalog** — the renderer owns that. What lives
 * here is only what the protocol and the worker need: the locale union itself, the agent-language
 * setting shape, and the one function that resolves the two into an effective language for a turn.
 */

/** Locales the app ships. Must stay in lockstep with the folders under `packages/ui/src/i18n/`. */
export const LOCALES = ["en", "ru"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * What the user picked for the agent. `"match-ui"` is the default and means "whatever the
 * interface language is", so a user who only ever changes one setting still gets a coherent app.
 */
export type AgentLanguage = "match-ui" | Locale;

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isAgentLanguage(value: unknown): value is AgentLanguage {
  return value === "match-ui" || isLocale(value);
}

/**
 * The single source of truth for "what language should the agent answer in on this turn".
 *
 * Precedence is session override → global preference → UI locale. Keeping it as one pure function
 * means the renderer, the host and the worker cannot drift apart on the answer, which matters
 * because all three need it: the renderer to label the picker, the host to persist it onto session
 * metadata, and the worker to build the turn's system prompt.
 */
export function resolveAgentLocale(
  sessionOverride: AgentLanguage | undefined,
  globalDefault: AgentLanguage | undefined,
  uiLocale: Locale,
): Locale {
  const picked = sessionOverride ?? globalDefault ?? "match-ui";
  return picked === "match-ui" ? uiLocale : picked;
}
