import { createFileTreeIconResolver, getBuiltInSpriteSheet } from "@pierre/trees";

/**
 * Renders a `@pierre/trees` built-in file icon in the **light DOM** (the tree itself renders
 * its icons inside a shadow root). Used so non-tree surfaces — the git sidebar — show the
 * same per-file-type icons as the file tree.
 *
 * How it works: `resolveIcon` maps a path to a built-in token + sprite symbol id; we render
 * `<svg><use href="#symbol"/></svg>`. The sprite sheet is injected once into `document.body`.
 * Per-language colour comes from `theme/pierre-file-icons.css` (Pierre's palette, scoped to
 * `.pid-pierre-icon`); the icon paths use `currentColor`, which that CSS sets per token.
 */
const ICON_SET = "complete" as const;
const resolver = createFileTreeIconResolver({ set: ICON_SET, colored: true });

let spriteInjected = false;
function ensureSpriteInjected(): void {
  if (spriteInjected || typeof document === "undefined") return;
  spriteInjected = true;
  const host = document.createElement("div");
  host.dataset.pierreIconSprite = "true";
  host.setAttribute("aria-hidden", "true");
  host.style.position = "absolute";
  host.style.width = "0";
  host.style.height = "0";
  host.style.overflow = "hidden";
  host.innerHTML = getBuiltInSpriteSheet(ICON_SET);
  document.body.appendChild(host);
}

interface PidPierreFileIconProps {
  /** File path or basename — drives the icon mapping. */
  path: string;
  /** Square pixel size. Defaults to 14 to match the surrounding rail text. */
  size?: number;
  className?: string;
}

export function PidPierreFileIcon({ path, size = 14, className }: PidPierreFileIconProps) {
  // Idempotent + guarded; injects the shared sprite the first time any icon renders so the
  // `<use>` reference resolves on first paint.
  ensureSpriteInjected();
  const resolved = resolver.resolveIcon("file-tree-icon-file", path);
  return (
    <svg
      className={className ? `pid-pierre-icon ${className}` : "pid-pierre-icon"}
      data-icon-token={resolved.token}
      width={size}
      height={size}
      viewBox={resolved.viewBox ?? "0 0 16 16"}
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#${resolved.name}`} />
    </svg>
  );
}
