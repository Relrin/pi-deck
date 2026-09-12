import type {
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ExtensionAPI,
  ExtensionFactory,
} from "@earendil-works/pi-coding-agent";
import { outputLanguageDirective } from "../../i18n/agent-strings.js";
import { DEFAULT_LOCALE, type Locale } from "../../i18n/locale.js";

export interface LanguageExtensionOptions {
  /** Language the agent starts the session in. Defaults to English. */
  initialLocale?: Locale;
}

export interface LanguageController {
  factory: ExtensionFactory;
  /** Change the language for every subsequent turn. Takes effect without a worker respawn. */
  setLanguage: (locale: Locale) => void;
  getLanguage: () => Locale;
}

/**
 * Appends the output-language directive to each turn's system prompt.
 *
 * Deliberately a `before_agent_start` hook and **not** `DefaultResourceLoader`'s
 * `appendSystemPrompt`. That loader is constructed once when the worker spawns, so honouring a
 * language change would mean respawning — which drops in-flight state and re-reads the session
 * file. This hook fires per turn instead, so flipping the language mid-session applies to the very
 * next prompt with nothing torn down.
 *
 * Owns no IO. The host pokes `setLanguage` over the same JSONL channel it uses for `setAgentMode`.
 */
export function createLanguageExtension(
  options: LanguageExtensionOptions = {},
): LanguageController {
  let locale: Locale = options.initialLocale ?? DEFAULT_LOCALE;

  const factory: ExtensionFactory = (pi: ExtensionAPI) => {
    pi.on(
      "before_agent_start",
      (event: BeforeAgentStartEvent): BeforeAgentStartEventResult | undefined => {
        // English is what pi-ai's own prompt is already written in, so saying so again would be
        // pure token cost for no behavioural change.
        if (locale === DEFAULT_LOCALE) return undefined;
        return {
          systemPrompt: `${event.systemPrompt.trimEnd()}\n\n${outputLanguageDirective(locale)}\n`,
        };
      },
    );
  };

  return {
    factory,
    setLanguage(next) {
      locale = next;
    },
    getLanguage() {
      return locale;
    },
  };
}
