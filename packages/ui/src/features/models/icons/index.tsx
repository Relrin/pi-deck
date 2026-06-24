import {
  Anthropic,
  Cerebras,
  DeepSeek,
  Fireworks,
  Gemini,
  Grok,
  Groq,
  HuggingFace,
  Kimi,
  Minimax,
  Mistral,
  Moonshot,
  Nvidia,
  OpenAI,
  OpenRouter,
  Together,
  Zhipu,
} from "@lobehub/icons";
import type { ReactNode } from "react";
import { Settings } from "../../../components/icons/index.js";

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Provider mark map.
 *
 * Built-in providers use `@lobehub/icons` brand glyphs:
 *  - `<Brand>` (the default export, which is `<Brand.Mono>`) renders a monochrome path that
 *    inherits `currentColor` — exactly what our token-driven picker/composer/badge UI wants.
 *  - `<Brand.Avatar>` is a filled brand-coloured tile, used in the settings provider list
 *    where the larger 18px row benefits from the brand colour.
 *
 * The "custom" fallback uses Lucide's `Settings` icon so user-added OpenAI-compatible
 * endpoints (LM Studio, Ollama, ...) get a neutral marker.
 *
 * To add a new built-in provider:
 * 1. Append its entry to `BUILT_IN_PROVIDERS` in
 *    `packages/core/src/providers/built-ins.ts` (the `iconKey` is the map key below).
 * 2. Import the matching component from `@lobehub/icons` here and register it in
 *    `PROVIDER_ICONS` (and `PROVIDER_AVATARS` if you want a coloured settings row).
 */

const Custom = ({ size = 16, className }: IconProps) => (
  <Settings size={size} className={className} />
);

export const PROVIDER_ICONS: Record<string, (props: IconProps) => ReactNode> = {
  anthropic: ({ size = 16, className }) => <Anthropic size={size} className={className} />,
  openai: ({ size = 16, className }) => <OpenAI size={size} className={className} />,
  // Pi calls the provider `google` (matches `~/.pi/agent/auth.json`'s `google` key) but the
  // brand glyph is the Gemini logo.
  google: ({ size = 16, className }) => <Gemini size={size} className={className} />,
  deepseek: ({ size = 16, className }) => <DeepSeek size={size} className={className} />,
  moonshotai: ({ size = 16, className }) => <Moonshot size={size} className={className} />,
  "kimi-coding": ({ size = 16, className }) => <Kimi size={size} className={className} />,
  // Z.ai is Zhipu AI; its models are the GLM family.
  zai: ({ size = 16, className }) => <Zhipu size={size} className={className} />,
  minimax: ({ size = 16, className }) => <Minimax size={size} className={className} />,
  mistral: ({ size = 16, className }) => <Mistral size={size} className={className} />,
  // xAI's recognisable mark is the Grok glyph.
  xai: ({ size = 16, className }) => <Grok size={size} className={className} />,
  groq: ({ size = 16, className }) => <Groq size={size} className={className} />,
  cerebras: ({ size = 16, className }) => <Cerebras size={size} className={className} />,
  nvidia: ({ size = 16, className }) => <Nvidia size={size} className={className} />,
  fireworks: ({ size = 16, className }) => <Fireworks size={size} className={className} />,
  together: ({ size = 16, className }) => <Together size={size} className={className} />,
  huggingface: ({ size = 16, className }) => <HuggingFace size={size} className={className} />,
  openrouter: ({ size = 16, className }) => <OpenRouter size={size} className={className} />,
  custom: Custom,
};

/**
 * Brand-colour avatars for the settings list. Falls back to the monochrome mark if a
 * provider doesn't have an Avatar form (only `custom` for now).
 */
export const PROVIDER_AVATARS: Record<string, (props: IconProps) => ReactNode> = {
  anthropic: ({ size = 18, className }) => <Anthropic.Avatar size={size} className={className} />,
  openai: ({ size = 18, className }) => <OpenAI.Avatar size={size} className={className} />,
  google: ({ size = 18, className }) => <Gemini.Avatar size={size} className={className} />,
  deepseek: ({ size = 18, className }) => <DeepSeek.Avatar size={size} className={className} />,
  moonshotai: ({ size = 18, className }) => <Moonshot.Avatar size={size} className={className} />,
  "kimi-coding": ({ size = 18, className }) => <Kimi.Avatar size={size} className={className} />,
  zai: ({ size = 18, className }) => <Zhipu.Avatar size={size} className={className} />,
  minimax: ({ size = 18, className }) => <Minimax.Avatar size={size} className={className} />,
  mistral: ({ size = 18, className }) => <Mistral.Avatar size={size} className={className} />,
  xai: ({ size = 18, className }) => <Grok.Avatar size={size} className={className} />,
  groq: ({ size = 18, className }) => <Groq.Avatar size={size} className={className} />,
  cerebras: ({ size = 18, className }) => <Cerebras.Avatar size={size} className={className} />,
  nvidia: ({ size = 18, className }) => <Nvidia.Avatar size={size} className={className} />,
  fireworks: ({ size = 18, className }) => <Fireworks.Avatar size={size} className={className} />,
  together: ({ size = 18, className }) => <Together.Avatar size={size} className={className} />,
  huggingface: ({ size = 18, className }) => (
    <HuggingFace.Avatar size={size} className={className} />
  ),
  openrouter: ({ size = 18, className }) => <OpenRouter.Avatar size={size} className={className} />,
  custom: Custom,
};

export function ProviderIcon({
  iconKey,
  size = 16,
  className,
}: {
  iconKey: string;
  size?: number;
  className?: string;
}) {
  const Comp = PROVIDER_ICONS[iconKey] ?? Custom;
  return <Comp size={size} className={className} />;
}

/**
 * Brand-coloured tile variant. Use in the settings provider list; everywhere else
 * (`ModelPicker`, `ModelBadge`, composer `ModelMenu`) keep using `ProviderIcon` so the icon
 * inherits the active theme's `--ink-*` colours.
 */
export function ProviderAvatar({
  iconKey,
  size = 18,
  className,
}: {
  iconKey: string;
  size?: number;
  className?: string;
}) {
  const Comp = PROVIDER_AVATARS[iconKey] ?? Custom;
  return <Comp size={size} className={className} />;
}
