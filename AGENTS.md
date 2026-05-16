# AGENTS.md

This file is read by both humans and AI coding agents working on pi-deck. It is the canonical project handbook. Keep it accurate. **Every plan in `plans/` ends with explicit additions to this file — apply them when you finish that plan, not later.**

## What pi-deck is

A friendly desktop and web client for the [pi coding agent](https://github.com/earendil-works/pi). pi-deck does not implement an agent loop itself; it embeds pi's `AgentSession` SDK and renders the result.

## Stack

- **Runtime:** Bun (package manager + script runner) and Node 20+ (for things Bun doesn't yet do well, like `node-pty`).
- **Language:** TypeScript everywhere. No JavaScript except generated config.
- **UI:** React 19 + Vite. CSS variables + Tailwind v4 for styling.
- **Desktop shell:** Electron
- **Agent embedding:** `@earendil-works/pi-coding-agent` `AgentSession` API, one Node subprocess per active session.
- **Renderer ↔ backend transport:** WebSocket over localhost. Same protocol works for the standalone web target.
- **Diffs:** `@pierre/diffs` (built on Shiki).
- **Lint / format:** Biome.
- **Tests:** `bun test` for unit, Playwright for end-to-end (introduced later).

## Repo layout

```
pi-deck/
├── packages/
│   ├── core/        Shared backend logic: session worker, protocol, git, extensions, terminal
│   ├── ui/          Shared React UI (components, stores, theme system)
│   ├── desktop/     Electron main process + thin bootstrap
│   └── web/         Standalone web server (added in plan 011)
├── plans/           Numbered .md feature plans — execute in order
├── scripts/         Repo automation (release, version bump, etc.)
└── .github/         CI/CD workflows
```

The `vscode/` package slot is reserved but unused for now. The architecture leaves room for a future VS Code extension that reuses `packages/ui` in a webview.

## Where user data lives

- **pi's own data:** untouched. Sessions stay at pi's default location (`~/.pi/agent/sessions/`).
- **pi-deck data:** `~/.config/pi-deck/` (or platform equivalent). Layout:
  - `projects/<project-id>/metadata.json` — pi-deck's view of a project (display name, pinned sessions, last opened, etc.) referencing pi session IDs.
  - `themes/` — installed JSON themes.
  - `extensions/` — installed extensions.
  - `providers.json` — custom provider endpoints (OpenRouter keys, LM Studio URL, etc.).
  - `settings.json` — global app preferences.

## Commands

```bash
bun install           # All workspaces
bun run check         # Lint + format check + type-check (must be green before commit)
bun run lint
bun run type-check
bun run test
bun run desktop:dev   # Electron in dev mode
bun run web:dev       # Standalone web server (after plan 011)
bun run build         # Production build
```

`bun run check` is wired into the pre-commit hook via Husky. Don't disable it.

## Coding conventions

- **TypeScript:** no `any`, no blind casts. If you have to escape the type system, leave a `// FIXME(types): why` comment.
- **React:** function components + hooks. Class components only for error boundaries.
- **Control flow:** prefer early returns over nested ternaries. Switch over chained `else if` for finite discriminated unions.
- **Imports:** absolute imports rooted at the package via tsconfig paths, not deep relative `../../..`.
- **State:** Zustand for global stores. `useState`/`useReducer` for local. No Redux.
- **Styling:** Tailwind v4 utility classes. Custom CSS only for things Tailwind can't express (animations, complex grid). Never hardcode colours — always reference CSS variables defined in `packages/ui/src/theme/tokens.css`.
- **File names:** kebab-case for files, PascalCase for React components (`SessionsList.tsx`), camelCase for hooks (`useSessions.ts`).
- **Stores:** one Zustand store per domain (`useXStore`). Stores expose actions and selectors; UI uses selectors only. Never mutate store state from outside the store's actions.
- **Markdown:** route all assistant text through the chat `Markdown` component (`packages/ui/src/features/chat/messages/Markdown.tsx`). It owns Shiki highlighting, autolinking, and the GFM dialect. Don't render raw markdown ad-hoc.
- **Icons:** import from `packages/ui/src/components/icons` only. This is the swap point if we change icon libraries.

## Do not

- Modify pi's source or wrap its protocol in incompatible ways. We are a *client*, not a fork.
- Add MCP support. pi doesn't have it and we don't either. (If a user wants MCP, they can write a pi extension.)
- Add dependencies without a clear reason. Especially anything that adds a transitive native module — those slow down install and Electron packaging.
- Log API keys, OAuth tokens, or session content to disk outside the documented locations.
- Use `console.log` in committed code. Use the structured logger (added in a later plan).
- Touch `~/.pi/` directly. Always go through pi's API.

## Per-subsystem entry points

This list is populated as plans complete. When you finish a plan, add its key entry points here.

- **Workspace & tooling** — `package.json`, `tsconfig.base.json`, `biome.json`, `bunfig.toml`. All commands flow through Bun. Pre-commit hook is `.husky/pre-commit`.
- **CI/CD** — `.github/workflows/ci.yml` (PR gate), `.github/workflows/release.yml` (tag-triggered builds). Release versioning via `scripts/version.ts`. Electron packaging config lives at `packages/desktop/electron-builder.yml`.
- **Electron shell** — main process at `packages/desktop/src/main/`, preload at `packages/desktop/src/preload/`. Renderer is the React app from `packages/ui`. Dev: `bun run desktop:dev`. Build: `bun run --filter @pi-deck/desktop dist`. Window bounds persist to `userData/window-state.json`.
- **Layout shell** — `packages/ui/src/layout/AppShell.tsx` owns the three-pane grid. Panel state is a Zustand store at `packages/ui/src/layout/use-panel-state.ts`.
- **Protocol** — `packages/core/src/protocol/`. `Frame`, `Command`, event topic types and zod schemas. Protocol version constant in `version.ts`. Any new command or event must update this folder.
- **Host (Electron main side)** — `packages/core/src/host/`. Owns the WebSocket server, session manager, and metadata store. Entry: `startHost()`. Auth token is generated per app launch and passed via the preload bridge (`window.bridge.connect()` returns `{ url, token }`).
- **Session worker** — `packages/core/src/worker/`. One Node subprocess per active session, hosting pi's `AgentSession`. Communicates with the host via LF-delimited JSONL on stdio. Bundled to `packages/desktop/dist/worker.js`; spawned in production via `process.execPath` with `ELECTRON_RUN_AS_NODE=1`.
- **Transport client** — `packages/ui/src/lib/transport/`. WS client + typed protocol client. All renderer-side calls to the host go through here.
- **User data** — `~/.config/pi-deck/projects/<id>/metadata.json` is pi-deck's thin metadata layer (Electron's `userData` path). pi's own sessions stay at `~/.pi/agent/sessions/`. Never write to pi's directories directly.
- **Chat UI** — `packages/ui/src/features/chat/`. `ChatView` is the root, owns `MessageList` + `MessageInput`. Messages live in `useMessagesStore` keyed by session id.
- **Tool call rendering** — `packages/ui/src/features/chat/tools/`. Renderers register into `ToolRendererRegistry`. Built-in renderers cover all pi default tools. To add a renderer for a new tool, create a component and call `registerToolRenderer(name, component)`. Extensions plug into the same registry (plan 009).
- **UI primitives** — `packages/ui/src/components/ui/`. Built on Radix. Always prefer extending these over importing Radix directly in feature code.
- **Sessions / projects state** — `useProjectsStore`, `useSessionsStore`, `useMessagesStore` in `packages/ui/src/features/sessions/` and `packages/ui/src/features/chat/`. A single `routeEvent` function in `packages/ui/src/lib/transport/event-router.ts` is the only event subscriber; it dispatches into the stores.
- **Message context menu** — `packages/ui/src/features/chat/messages/MessageContextMenu.tsx` wraps each user/assistant message in a Radix `ContextMenu`. Actions: Copy text, Copy as Markdown, Attach selection to next prompt (routes via `useDraftStore`). Tool-call cards are intentionally not selectable.
- **Composer state** — `packages/ui/src/features/chat/composer/useComposerStore.ts` (persisted Zustand under `pi-deck:composer`) holds execution mode, model, and thinking effort. UI-only today (see `// TODO(protocol)` in the file); will forward to pi when the SDK exposes setters. Bottom-bar controls live in `ExecutionModeMenu.tsx`, `ModelMenu.tsx`, `ContextUsageIndicator.tsx` under the same folder.
- **Usage tracking** — `packages/ui/src/features/chat/useUsageStore.ts` reads per-turn `usage` + `contextUsage` from `EVENT_SESSION_TURN_END`. Worker source: `packages/core/src/worker/agent-bridge.ts:forwardEvent` extracts `message.usage` and calls `session.getContextUsage()`. The per-category breakdown in `ContextUsageIndicator` is derived renderer-side from the messages store because pi's `ContextUsage` is aggregate-only.
- **Theme system** — `packages/ui/src/theme/`. Tokens defined in `tokens.css` using descriptive names (`--bg-0..3`, `--ink-0..3`, `--accent*`, `--add/del/mod`, `--diff-*`). Active theme is JSON, applied by `loader.ts` as inline custom properties on `<html>`. VS Code themes are imported via `vscode-adapter.ts`. Shiki bridge in `shiki-bridge.ts` keeps syntax highlighting aligned with the active theme. Six bundled palettes: default / phosphor / nightshade × dark / light. The canonical Zod schema lives in `packages/core/src/protocol/theme.ts` and is re-exported via `@pi-deck/core`.
- **Theme storage & hot reload** — `packages/core/src/host/themes/`. Bundled JSON lives in `packages/core/src/host/themes/bundled/` and is imported with `with { type: "json" }`. User themes live at `<userData>/themes/` (Electron `app.getPath("userData")`). Chokidar watches the dir and emits `theme.changed` events; if the active theme's spec changed on disk, the new spec ships in the event payload so the renderer re-applies without a round-trip.
- **Renderer prefs** — `packages/ui/src/theme/usePreferencesStore.ts`. Density (compact/cozy) and font-pair (default/sans-only/mono-only) live here, separate from theme. Persisted to localStorage under `pi-deck:prefs`. Hydrated pre-mount via the inline script in `packages/desktop/index.html` so the first paint matches the user's preference.

## Styling rules

- **Never hardcode colours.** Always use a CSS variable from `tokens.css`. Adding a colour means proposing a new token.
- **The token list is small on purpose.** If you find yourself reaching for "another shade of grey", reuse an existing surface token first.
- **VS Code theme compatibility is best-effort, not pixel-perfect.** Imported themes will look close, not identical. Don't add a token just to match a VS Code-specific colour key - map it to the closest existing token instead.
- **Shiki and pi-deck share the active theme.** When the active theme came from a VS Code JSON, Shiki uses that JSON directly. Otherwise it uses a curated bundled Shiki theme that matches our tokens.
- **Adding a token** requires updating every bundled theme JSON in `packages/core/src/host/themes/bundled/` AND adding a fallback to the VS Code adapter's translation table.
- **Compat aliases** (`--color-*` → `--bg-*`/`--ink-*`) in `tokens.css` are temporary. Remove each alias as the legacy file referencing it migrates.

## Protocol stability

The renderer↔host protocol is versioned (`packages/core/src/protocol/version.ts`). When you change a command or event payload shape:

1. Bump the protocol version.
2. Update the schema in `protocol/frames.ts` or sibling files.
3. The renderer sends the version on connect; the host rejects mismatches with a clear error. This means renderer with host must always ship together (no skew across an auto-update).
4. The host <-> worker stdio protocol is internal and unversioned - workers are spawned from the same binary so they're always in sync.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer never has direct Node access. Anything OS-level goes through the preload bridge.
- A localhost-only WebSocket is the renderer <-> backend transport. The server binds to `127.0.0.1` only and authenticates with a short-lived token generated at app start.
- No remote content loaded into the main BrowserWindow. External links open in the OS browser via `shell.openExternal`.

## Acceptance gate for every change

Before opening a PR:

1. `bun run check` is green.
2. The change matches the file-by-file outline of the relevant plan.
3. AGENTS.md has been updated per the plan's "AGENTS.md updates" section.
4. The acceptance criteria from the plan are hand-verified.
