import type { ReactNode } from "react";
import { Glyph } from "../../../components/glyph";

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Inline monochrome SVG glyphs per built-in provider. Drawn at 16px on a 0-16 viewbox and
 * coloured via `currentColor` so they take on the picker's `--ink-*` / `--accent` tokens.
 * Each glyph gets a hidden `<title>` so screen readers announce the provider name.
 */
function makeMark(name: string, d: string) {
  return ({ size = 16, className }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={`${name} logo`}
    >
      <title>{name}</title>
      <path d={d} />
    </svg>
  );
}

const Anthropic = makeMark("Anthropic", "M3 13 L7 3 L9 3 L13 13 M5 9 H11");
const OpenAI = makeMark("OpenAI", "M8 3 A5 5 0 1 0 8 13 A5 5 0 1 0 8 3 M5 8 H11 M8 5 V11");
const Google = makeMark("Google", "M12 8 A4 4 0 1 1 8 4 H12 V8");
const Groq = makeMark("Groq", "M4 4 H12 V12 H4 Z M4 8 H12");
const Cerebras = makeMark("Cerebras", "M8 3 V13 M3 8 H13 M5 5 L11 11 M11 5 L5 11");
const OpenRouter = makeMark("OpenRouter", "M3 5 H10 A3 3 0 0 1 10 11 H3 M10 8 H13");
const Custom = ({ size = 16, className }: IconProps) => (
  <Glyph kind="settings" size={size} className={className} />
);

export const PROVIDER_ICONS: Record<string, (props: IconProps) => ReactNode> = {
  anthropic: Anthropic,
  openai: OpenAI,
  google: Google,
  groq: Groq,
  cerebras: Cerebras,
  openrouter: OpenRouter,
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
