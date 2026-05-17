// Renderer-facing barrel. Only re-export modules that are safe to bundle into a browser
// build — anything that touches `node:fs`, `node:os`, etc. must be imported by the host via
// a direct subpath (e.g. `@pi-deck/core/providers/registry.js`) instead.
export * from "./built-ins.js";
export * from "./types.js";
