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
