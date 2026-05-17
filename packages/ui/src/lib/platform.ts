export type PlatformOs = "darwin" | "linux" | "win32" | string;

// The preload bridge exposes platform info on window.platform. Falls back to undefined
// in non-Electron contexts (web target, tests); callers treat that as non-darwin.
export function getPlatformOs(): PlatformOs | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { platform?: { os?: PlatformOs } };
  return w.platform?.os;
}

export function isMacOs(): boolean {
  return getPlatformOs() === "darwin";
}

// Modifier-key glyphs for kbd badges and tooltips. On macOS we use the conventional
// symbols (⌘ ⇧); elsewhere we spell them out so a Windows user immediately recognises
// the binding.
export function metaSymbol(): string {
  return isMacOs() ? "⌘" : "Ctrl";
}

export function shiftSymbol(): string {
  return isMacOs() ? "⇧" : "Shift";
}

// Windows + Linux paint native min/max/close inside the topbar area via
// BrowserWindow.titleBarOverlay. Those buttons sit on top of our DOM, so any
// full-width header (the app topbar, the settings overlay header, …) must pad
// its right edge to leave room. Empirically ~140px covers Windows 1.0 DPI;
// tighter scales fit comfortably under it.
export const NATIVE_OVERLAY_RESERVE_PX = 144;

export function reservesNativeOverlay(): boolean {
  const os = getPlatformOs();
  return os === "win32" || os === "linux";
}

export function getAppVersion(): string {
  if (typeof window === "undefined") return "dev";
  return window.appVersion ?? "dev";
}
