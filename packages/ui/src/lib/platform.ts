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

export function getAppVersion(): string {
  if (typeof window === "undefined") return "dev";
  return window.appVersion ?? "dev";
}
