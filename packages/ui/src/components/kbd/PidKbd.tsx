import type { HTMLAttributes } from "react";

export interface PidKbdProps extends HTMLAttributes<HTMLElement> {
  /** Ordered list of key names. `Mod` → ⌘ on darwin, Ctrl elsewhere. Each renders its own <kbd>. */
  keys: string[];
}

function getPlatformOs(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { platform?: { os?: string } };
  return w.platform?.os;
}

function prettify(key: string, isMac: boolean): string {
  switch (key) {
    case "Mod":
    case "Meta":
    case "Cmd":
      return isMac ? "⌘" : "Ctrl";
    case "Ctrl":
      return isMac ? "⌃" : "Ctrl";
    case "Alt":
    case "Option":
      return isMac ? "⌥" : "Alt";
    case "Shift":
      return isMac ? "⇧" : "Shift";
    case "Enter":
      return "↵";
    case "Esc":
    case "Escape":
      return "Esc";
    default:
      return key;
  }
}

export function PidKbd({ keys, className, ...rest }: PidKbdProps) {
  const isMac = getPlatformOs() === "darwin";
  const classes = ["pid-kbd", className].filter(Boolean).join(" ");
  return (
    <span {...rest} style={{ display: "inline-flex", alignItems: "center", ...rest.style }}>
      {keys.map((key) => (
        <kbd key={key} className={classes}>
          {prettify(key, isMac)}
        </kbd>
      ))}
    </span>
  );
}
