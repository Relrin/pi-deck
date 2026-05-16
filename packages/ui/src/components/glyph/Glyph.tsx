import { GLYPH_PRIMITIVES, type GlyphKind } from "./kinds.js";

export interface GlyphProps {
  kind: GlyphKind;
  size?: number;
  /** When set, the glyph is exposed to assistive tech via a <title>; otherwise it's hidden. */
  label?: string;
  className?: string;
}

export function Glyph({ kind, size = 14, label, className }: GlyphProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative glyphs are aria-hidden; labelled glyphs include a <title> child below
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      className={className}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      {GLYPH_PRIMITIVES[kind]}
    </svg>
  );
}
