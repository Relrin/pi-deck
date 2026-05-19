export * from "./domain/index.js";
// Extensions live behind the `@pi-deck/core/extensions/...` sub-path. They are server-side
// only — `agent-mode/decision.ts` and `attachments/render.ts` import `node:path` / `node:fs`,
// which Vite cannot bundle for the renderer. Re-exporting them from the main barrel would
// drag those Node imports into every browser file that touches `@pi-deck/core` (theme types,
// protocol types, etc.) and crash the dev server.
export * from "./protocol/index.js";
export * from "./providers/index.js";
