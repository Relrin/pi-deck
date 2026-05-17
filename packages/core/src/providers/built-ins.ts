import type { BuiltInProviderDef, BuiltInProviderId } from "./types.js";

/**
 * Lean v1 list of built-in providers we surface in the picker. pi-ai supports ~24 more (Mistral,
 * DeepSeek, Vercel, Bedrock, …) that keep working via env vars without being listed here.
 *
 * `envVar` / `authJsonKey` values are copied verbatim from pi-coding-agent's
 * `docs/providers.md`. When adding a provider, double-check the slug against
 * `packages/ai/src/env-api-keys.ts` in pi-mono.
 */
export const BUILT_IN_PROVIDERS: readonly BuiltInProviderDef[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    authJsonKey: "anthropic",
    oauthSupported: true,
    iconKey: "anthropic",
  },
  {
    id: "openai",
    name: "OpenAI",
    envVar: "OPENAI_API_KEY",
    authJsonKey: "openai",
    oauthSupported: true,
    iconKey: "openai",
  },
  {
    id: "google",
    name: "Google Gemini",
    envVar: "GEMINI_API_KEY",
    authJsonKey: "google",
    oauthSupported: true,
    iconKey: "google",
  },
  {
    id: "groq",
    name: "Groq",
    envVar: "GROQ_API_KEY",
    authJsonKey: "groq",
    oauthSupported: false,
    iconKey: "groq",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    envVar: "CEREBRAS_API_KEY",
    authJsonKey: "cerebras",
    oauthSupported: false,
    iconKey: "cerebras",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    authJsonKey: "openrouter",
    oauthSupported: false,
    iconKey: "openrouter",
  },
] as const;

const BUILT_IN_BY_ID = new Map<string, BuiltInProviderDef>(
  BUILT_IN_PROVIDERS.map((p) => [p.id, p]),
);

export function getBuiltInProvider(id: string): BuiltInProviderDef | undefined {
  return BUILT_IN_BY_ID.get(id);
}

export function isBuiltInProvider(id: string): id is BuiltInProviderId {
  return BUILT_IN_BY_ID.has(id);
}
