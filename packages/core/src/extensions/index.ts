/**
 * Built-in pi-deck plugins that extend the pi coding agent.
 *
 * Each plugin lives in its own folder and is exposed through a factory function:
 *
 * - `createAgentModeExtension` — enforces the composer's `ask` / `accept-edits` / `plan`
 *   permission modes on tool calls.
 * - `createAttachmentsExtension` — materializes user-staged files, folders, and repo refs
 *   into a custom message prepended to the agent's turn.
 *
 * Both plugins are loaded into pi-ai through `DefaultResourceLoader({ extensionFactories })`
 * inside the worker. They are also exported from `@pi-deck/core` so future user-authored
 * extensions can compose against the same primitives.
 */
export * from "./agent-mode/index.js";
export * from "./attachments/index.js";
