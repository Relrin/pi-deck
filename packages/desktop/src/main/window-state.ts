import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";

export type WindowBounds = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

const FILE_NAME = "window-state.json";

function statePath(): string {
  return join(app.getPath("userData"), FILE_NAME);
}

export function loadState(): WindowBounds | null {
  const path = statePath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<WindowBounds>;
    if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return null;
    return {
      width: parsed.width,
      height: parsed.height,
      x: typeof parsed.x === "number" ? parsed.x : undefined,
      y: typeof parsed.y === "number" ? parsed.y : undefined,
    };
  } catch {
    return null;
  }
}

export function saveState(bounds: WindowBounds): void {
  try {
    writeFileSync(statePath(), JSON.stringify(bounds, null, 2), "utf8");
  } catch {
    // Persistence is best-effort; silently swallow.
  }
}
