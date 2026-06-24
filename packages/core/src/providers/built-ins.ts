import type { BuiltInProviderDef, BuiltInProviderId } from "./types.js";

/**
 * Built-in providers surfaced in the "Add provider" picker. This is the set of single-token
 * API-key providers pi supports — adding a key here makes pi's catalogue of that provider's
 * models available in the picker.
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
  // Single-token API-key providers.
  {
    id: "deepseek",
    name: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    authJsonKey: "deepseek",
    oauthSupported: false,
    iconKey: "deepseek",
  },
  {
    id: "moonshotai",
    name: "Moonshot AI",
    envVar: "MOONSHOT_API_KEY",
    authJsonKey: "moonshotai",
    oauthSupported: false,
    iconKey: "moonshotai",
  },
  {
    id: "kimi-coding",
    name: "Kimi For Coding",
    envVar: "KIMI_API_KEY",
    authJsonKey: "kimi-coding",
    oauthSupported: false,
    iconKey: "kimi-coding",
  },
  {
    id: "zai",
    name: "Z.ai (GLM)",
    envVar: "ZAI_API_KEY",
    authJsonKey: "zai",
    oauthSupported: false,
    iconKey: "zai",
  },
  {
    id: "minimax",
    name: "MiniMax",
    envVar: "MINIMAX_API_KEY",
    authJsonKey: "minimax",
    oauthSupported: false,
    iconKey: "minimax",
  },
  {
    id: "mistral",
    name: "Mistral",
    envVar: "MISTRAL_API_KEY",
    authJsonKey: "mistral",
    oauthSupported: false,
    iconKey: "mistral",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    envVar: "XAI_API_KEY",
    authJsonKey: "xai",
    oauthSupported: false,
    iconKey: "xai",
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
    id: "nvidia",
    name: "NVIDIA NIM",
    envVar: "NVIDIA_API_KEY",
    authJsonKey: "nvidia",
    oauthSupported: false,
    iconKey: "nvidia",
  },
  {
    id: "fireworks",
    name: "Fireworks",
    envVar: "FIREWORKS_API_KEY",
    authJsonKey: "fireworks",
    oauthSupported: false,
    iconKey: "fireworks",
  },
  {
    id: "together",
    name: "Together AI",
    envVar: "TOGETHER_API_KEY",
    authJsonKey: "together",
    oauthSupported: false,
    iconKey: "together",
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    envVar: "HF_TOKEN",
    authJsonKey: "huggingface",
    oauthSupported: false,
    iconKey: "huggingface",
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
