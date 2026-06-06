import { Terminal } from "../../components/icons/index.js";

/**
 * Brand glyph for a detected shell, rendered with Devicon's icon font (`devicon.min.css`, imported
 * in globals.css). Each `<i class="devicon-<name>-plain colored">` is a single-colour font glyph in
 * its official brand colour; a few too-dark-for-the-dark-menu colours are lifted in components.css
 * (`.pid-shell-icon.devicon-*`). Shells Devicon lacks (fish/sh/unknown) fall back to Lucide.
 */

const KIND_DEVICON: Record<string, string> = {
  powershell: "powershell",
  cmd: "windows11",
  gitbash: "git",
  bash: "bash",
  zsh: "zsh",
};

const DISTRO_DEVICON: Array<{ match: RegExp; name: string }> = [
  { match: /ubuntu/i, name: "ubuntu" },
  { match: /debian/i, name: "debian" },
  { match: /kali/i, name: "kalilinux" },
  { match: /arch/i, name: "archlinux" },
  { match: /fedora/i, name: "fedora" },
  { match: /suse/i, name: "opensuse" },
];

/** Devicon icon name for a shell, or undefined when Devicon has no glyph (→ Lucide fallback). */
function deviconName(kind: string | undefined, label: string): string | undefined {
  if (kind === "wsl") return DISTRO_DEVICON.find((d) => d.match.test(label))?.name ?? "linux";
  return kind ? KIND_DEVICON[kind] : undefined;
}

export function ShellTypeIcon({
  kind,
  label,
  size = 14,
}: {
  kind: string | undefined;
  label: string;
  size?: number;
}) {
  const name = deviconName(kind, label);
  if (!name) return <Terminal size={size} aria-hidden />;
  return (
    <i className={`devicon-${name}-plain colored pid-shell-icon`} style={{ fontSize: size }} />
  );
}
