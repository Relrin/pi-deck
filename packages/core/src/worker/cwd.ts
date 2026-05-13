import { statSync } from "node:fs";

export function validateAndChdir(path: string): void {
  let info: ReturnType<typeof statSync>;
  try {
    info = statSync(path);
  } catch (err) {
    throw new Error(`Project path does not exist: ${path} (${(err as Error).message})`);
  }
  if (!info.isDirectory()) {
    throw new Error(`Project path is not a directory: ${path}`);
  }
  process.chdir(path);
}
