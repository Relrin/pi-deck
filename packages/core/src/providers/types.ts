import { z } from "zod";
import { SessionModelRefSchema, ThinkingLevelSchema } from "../domain/session.js";

/**
 * pi-ai provider slugs we surface natively in the picker for v1. Other ~18 providers pi
 * supports still work via env vars, they just aren't listed here. Plan 006 — Lean v1.
 */
export const BUILT_IN_PROVIDER_IDS = [
  "anthropic",
  "openai",
  "google",
  "groq",
  "cerebras",
  "openrouter",
] as const;

export type BuiltInProviderId = (typeof BUILT_IN_PROVIDER_IDS)[number];

export const ProviderKindSchema = z.enum(["built-in", "custom-openai-compatible"]);
export type ProviderKind = z.infer<typeof ProviderKindSchema>;

/**
 * Streaming API kinds we allow on a custom provider. Mirrors a subset of pi-ai's `Api` type;
 * we intentionally only expose openai-compatible flavours here — adding more later (Anthropic
 * Messages, Bedrock, Vertex …) means relaxing this enum.
 */
export const CustomProviderApiSchema = z.enum(["openai-completions", "openai-responses"]);
export type CustomProviderApi = z.infer<typeof CustomProviderApiSchema>;

/**
 * Static metadata for a built-in provider. The `iconKey` is consumed by the renderer to look
 * up an inline `<Glyph>` composition under `packages/ui/src/features/models/icons`.
 */
export interface BuiltInProviderDef {
  id: BuiltInProviderId;
  /** Display label in the picker / settings list. */
  name: string;
  /** Key pi-ai uses for env-var resolution (e.g. `ANTHROPIC_API_KEY`). Used for diagnostics. */
  envVar: string;
  /** Key under which pi stores the credential in `~/.pi/agent/auth.json`. */
  authJsonKey: string;
  /** True if pi-ai (or the upstream service) supports OAuth/subscription auth. v1 disables it. */
  oauthSupported: boolean;
  /** Icon registry key, used by the renderer. */
  iconKey: string;
}

/** Persisted custom-provider record (one entry per LM Studio / Ollama / vLLM endpoint). */
export const CustomProviderDefSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9._-]*$/, "Provider id must be lowercase alphanumeric, dash or dot"),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  api: CustomProviderApiSchema,
  /** Default model id to use if catalogue fetch fails / returns nothing. */
  defaultModelId: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type CustomProviderDef = z.infer<typeof CustomProviderDefSchema>;

/** Input shape used by `provider.addCustom` — the server fills `id` + `createdAt`. */
export const CustomProviderInputSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  api: CustomProviderApiSchema.default("openai-completions"),
  /** Optional literal API key. Persisted to pi's `auth.json` under the provider id. */
  apiKey: z.string().optional(),
  defaultModelId: z.string().optional(),
});
export type CustomProviderInput = z.infer<typeof CustomProviderInputSchema>;

/** Auth-state vocabulary surfaced to the renderer. Secrets never cross the wire. */
export const AuthStateSchema = z.enum(["authenticated", "needs-key", "unreachable"]);
export type AuthState = z.infer<typeof AuthStateSchema>;

/** Compact provider record sent to the renderer. */
export const ProviderSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: ProviderKindSchema,
  iconKey: z.string(),
  envVar: z.string().optional(),
  authJsonKey: z.string(),
  oauthSupported: z.boolean(),
  authState: AuthStateSchema,
  /** Custom providers only: the OpenAI-compatible endpoint URL (no API key bleed). */
  baseUrl: z.string().url().optional(),
  api: CustomProviderApiSchema.optional(),
});
export type ProviderSummary = z.infer<typeof ProviderSummarySchema>;

/** Single model row in the picker. */
export const ModelInfoSchema = z.object({
  providerId: z.string().min(1),
  id: z.string().min(1),
  /** Display label (falls back to `id` when pi-ai exposes only the id). */
  label: z.string().min(1),
  contextWindow: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  supportsThinking: z.boolean(),
  modalities: z.array(z.enum(["text", "image"])).default(["text"]),
  /** Pricing in $ per million tokens, when known. */
  cost: z
    .object({
      input: z.number(),
      output: z.number(),
      cacheRead: z.number(),
      cacheWrite: z.number(),
    })
    .optional(),
  /** Permitted thinking levels (empty when not a reasoning model). */
  thinkingLevels: z.array(ThinkingLevelSchema).optional(),
});
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

/** Persisted shape of providers.json. */
export const ProvidersFileSchema = z.object({
  version: z.literal(1),
  customProviders: z.array(CustomProviderDefSchema).default([]),
  defaultModel: SessionModelRefSchema.optional(),
  perSessionModel: z
    .record(
      z.string(),
      z.object({ modelRef: SessionModelRefSchema, thinkingLevel: ThinkingLevelSchema.optional() }),
    )
    .default({}),
});
export type ProvidersFile = z.infer<typeof ProvidersFileSchema>;
