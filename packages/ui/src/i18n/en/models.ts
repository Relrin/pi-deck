/**
 * Strings for `features/models/`.
 *
 * Provider names, model names and model ids are **data** — they arrive from
 * `packages/core/src/providers/` and from the endpoints themselves, and none of them are here.
 * Neither are the `API_OPTIONS` labels (they name OpenAI's own APIs), the `sk-…` / `LM Studio` /
 * `qwen2.5-coder:7b` placeholders (worked examples), or `~/.pi/agent/auth.json` (a path).
 *
 * A string's namespace follows the file it lives in, not the screen it renders on: the three
 * dialogs below are rendered by `settings/sections/ProvidersSection.tsx`, but they live in
 * `features/models/`, so their copy is here rather than under `settings.agents`.
 */
const models = {
  /** `ModelPicker.tsx` — the full-screen picker. */
  picker: {
    title: "Select model",
    close: "Close model picker",
  },

  /** `ProviderList.tsx`. `STATE_LABEL` is keyed by the provider's auth state. */
  providers: {
    heading: "Providers",
    custom: "Custom",
    addCustom: "Add custom…",
    addCustomLabel: "Add custom provider",
    state: {
      authenticated: "Authenticated",
      needsKey: "Needs API key",
      unreachable: "Unreachable",
    },
  },

  /**
   * `ModelList.tsx`. The chips sit beside already-formatted numbers, so each is only its unit:
   * `ctx` after a context window, `in … / out …` around two prices.
   */
  list: {
    pickProvider: "Select a provider to see models.",
    /** `{provider}` is a provider name and passes through untranslated. */
    needsKey: "{provider:string} needs an API key.",
    addKey: "Add API key",
    filter: "Filter models",
    loading: "Loading models…",
    noMatches: "No matches.",
    noModels: "No models found.",
    chipContext: "ctx",
    chipPriceIn: "in",
    chipPriceOut: "/ out",
    chipThinking: "thinking",
  },

  /** `AddProviderDialog.tsx` — pick a built-in provider to add a key for. */
  addProvider: {
    eyebrow: "providers · pi",
    title: "Add provider",
    description:
      "Choose a provider and add an API key. Its models appear in the picker once a key is saved.",
    escHint: "esc",
    search: "Search providers — name or env var…",
    allConfigured: "Every built-in provider already has a key. Manage them on the previous screen.",
    noMatches: "No providers match",
    addKey: "Add key",
    available: "{count:number} available",
    /** Spliced with the auth-file path through `i18n/rich.tsx`. */
    keysSavedTo: "keys saved to {path:string}",
  },

  /** `AuthenticateProviderDialog.tsx`. */
  authenticate: {
    /** `{provider}` is a provider name; `provider` is the fallback when none is selected. */
    title: "Authenticate {provider:string}",
    titleFallback: "provider",
    description:
      "Paste an API key — it's forwarded to the host process and stored in pi's auth file, never echoed back to the renderer.",
    apiKey: "API key",
    /** Spliced with the auth-file path. `0600` is a permission mode, not copy. */
    storageHint:
      "Stored in pi's {path:string} (0600 perms). Never logged or sent back to the renderer.",
    oauthTitle: "OAuth landing in a future plan",
    oauth: "Use {provider:string} OAuth (coming soon)",
    submitting: "Saving…",
    submit: "Save & test",
    saveFailed: "Failed to save API key",
  },

  /** `AddCustomProviderDialog.tsx` — an OpenAI-compatible endpoint the user runs themselves. */
  addCustom: {
    title: "Add custom provider",
    description:
      "Connect an OpenAI-compatible endpoint such as LM Studio, Ollama, vLLM, or a self-hosted gateway.",
    name: "Name",
    baseUrl: "Base URL",
    apiKind: "API kind",
    apiKey: "API key (optional)",
    apiKeyPlaceholder: "Leave blank for unauthenticated endpoints",
    defaultModel: "Default model id (optional)",
    /** Spliced with a `<code>/v1/models</code>` element. */
    defaultModelHint: "Used when the endpoint doesn't expose {path:string}.",
    submitting: "Saving…",
    submit: "Add provider",
    saveFailed: "Failed to add provider",
  },

  /** Fallbacks passed to `humanizeError(err, …)` from `useProvidersStore.ts`. */
  errors: {
    loadProviders: "Failed to load providers",
    loadModels: "Failed to load models",
    switchModel: "Failed to switch model",
    setThinkingLevel: "Failed to set thinking level",
  },
} as const;

export default models;
