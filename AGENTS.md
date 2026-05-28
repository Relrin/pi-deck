# AGENTS.md

This file is read by both humans and AI coding agents working on pi-deck. It is the canonical project handbook. Keep it accurate.

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
│   └── web/         Standalone web servers
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

- **Git operations:** all go through `packages/core/src/git/runner.ts`. Direct spawning of `git` elsewhere is forbidden. Errors are typed (`GitNotFoundError`, `NotARepoError`, `GitCommandError`).

## Do not

- Modify pi's source or wrap its protocol in incompatible ways. We are a *client*, not a fork.
- Add MCP support. pi doesn't have it and we don't either. (If a user wants MCP, they can write a pi extension.)
- Add dependencies without a clear reason. Especially anything that adds a transitive native module — those slow down install and Electron packaging.
- Log API keys, OAuth tokens, or session content to disk outside the documented locations.
- Use `console.log` in committed code. Use the structured logger (added in a later plan).
- Touch `~/.pi/` directly with one exception: the provider registry writes `~/.pi/agent/models.json` and persists keys to `~/.pi/agent/auth.json` via pi's `AuthStorage` API. Everywhere else, go through pi's API.
- Send API keys to the renderer. The renderer can request "is provider X authenticated?" but the secret itself stays in the host.
- Log provider credentials in any form — even truncated.
- Hardcode model IDs anywhere outside `packages/core/src/providers/`. The registry is the only place that knows model strings; the UI fetches them through `provider.models`.

## Per-subsystem entry points

This list is populated as plans complete. When you finish a plan, add its key entry points here.

- **Workspace & tooling** — `package.json`, `tsconfig.base.json`, `biome.json`, `bunfig.toml`. All commands flow through Bun. Pre-commit hook is `.husky/pre-commit`.
- **CI/CD** — `.github/workflows/ci.yml` (PR gate), `.github/workflows/release.yml` (tag-triggered builds). Release versioning via `scripts/version.ts`. Electron packaging config lives at `packages/desktop/electron-builder.yml`.
- **Electron shell** — main process at `packages/desktop/src/main/`, preload at `packages/desktop/src/preload/`. Renderer is the React app from `packages/ui`. Dev: `bun run desktop:dev`. Build: `bun run --filter @pi-deck/desktop dist`. Window bounds persist to `userData/window-state.json`.
- **App shell** — `packages/ui/src/layout/PidAppShell.tsx` (+ `PidTopBar`, `PidBody`, `PidLeftRail`, `PidRightPane`, `PidFooter`). Fixed-width rails (264 left, 360 right). No resize handles. Layout CSS lives in `packages/ui/src/theme/shell.css`. The previous resizable shell is preserved at `packages/ui/src/layout/AppShell.legacy.tsx` (+ siblings) and is no longer wired into the renderer.
- **Protocol** — `packages/core/src/protocol/`. `Frame`, `Command`, event topic types and zod schemas. Protocol version constant in `version.ts`. Any new command or event must update this folder.
- **Host (Electron main side)** — `packages/core/src/host/`. Owns the WebSocket server, session manager, and metadata store. Entry: `startHost()`. Auth token is generated per app launch and passed via the preload bridge (`window.bridge.connect()` returns `{ url, token }`).
- **Session worker** — `packages/core/src/worker/`. One Node subprocess per active session, hosting pi's `AgentSession`. Communicates with the host via LF-delimited JSONL on stdio. Bundled to `packages/desktop/dist/worker.js`; spawned in production via `process.execPath` with `ELECTRON_RUN_AS_NODE=1`.
- **Transport client** — `packages/ui/src/lib/transport/`. WS client + typed protocol client. All renderer-side calls to the host go through here.
- **User data** — `~/.config/pi-deck/projects/<id>/metadata.json` is pi-deck's thin metadata layer (Electron's `userData` path). pi's own sessions stay at `~/.pi/agent/sessions/`. Never write to pi's directories directly.
- **Chat UI** — `packages/ui/src/features/chat/`. `ChatView` is the root, owns `MessageList` + `MessageInput`. Messages live in `useMessagesStore` keyed by session id.
- **Composer image attachments** — clipboard paste (Ctrl/Cmd+V), drag-drop, and an "Attach image…" popover entry stage images alongside file/folder chips. The flow lives in `packages/ui/src/features/chat/composer/useImagePaste.ts` (paste/drop + 10 MB cap + 256 px thumbnail via OffscreenCanvas) and the lightbox in `ImagePreviewDialog.tsx` (reuses `pid-modal-backdrop` / `pid-modal`). Drafts are kept in `useIntroComposerStore.images` (parallel to `attachments`, not persisted to localStorage). On Send the full base64 payload travels over `SessionPromptRequest.images` and pi receives them via `session.prompt(text, { images })` — the existing attachments extension already forwards `event.images` through pi's `input` event. Only a downscaled thumbnail is persisted onto the optimistic `UserMessageEntry.images` (in `useMessagesStore`) so the user-message bubble keeps its preview on scroll-back; full bytes are dropped from the renderer after Send. Filesystem-sourced images flow through `window.bridge.readImage(path)` (Electron main IPC at `bridge:readImage`) because the sandboxed renderer can't `fs.readFile` directly.
- **MessageList auto-scroll** — pinning to the latest message uses `virtualizer.scrollToIndex(last, { align: "end" })`, not `el.scrollTop = el.scrollHeight`. The manual approach lands above the real bottom because `@tanstack/react-virtual` reports a stale `getTotalSize()` before dynamic rows are measured. The raw `scrollTop` write is reserved for restoring a saved pixel offset (the "user had scrolled up" branch).
- **Tool call rendering** — `packages/ui/src/features/chat/tools/`. Renderers register into `ToolRendererRegistry`. Built-in renderers cover all pi default tools. To add a renderer for a new tool, create a component and call `registerToolRenderer(name, component)`.
- **UI primitives** — `packages/ui/src/components/ui/`. Built on Radix. Always prefer extending these over importing Radix directly in feature code.
- **Sessions / projects state** — `useProjectsStore`, `useSessionsStore`, `useMessagesStore` in `packages/ui/src/features/sessions/` and `packages/ui/src/features/chat/`. A single `routeEvent` function in `packages/ui/src/lib/transport/event-router.ts` is the only event subscriber; it dispatches into the stores.
- **Message context menu** — `packages/ui/src/features/chat/messages/MessageContextMenu.tsx` wraps each user/assistant message in a Radix `ContextMenu`. Actions: Copy text, Copy as Markdown, Attach selection to next prompt (routes via `useDraftStore`). Tool-call cards are intentionally not selectable.
- **Composer state** — `packages/ui/src/features/chat/composer/useComposerStore.ts` (persisted Zustand under `pi-deck:composer`) holds the execution mode only. UI-only today (see `// TODO(protocol)` in the file); will forward to pi when the SDK exposes a setter for permission mode. Model + thinking-level moved to `useProvidersStore` (per-session). Bottom-bar controls live in `ExecutionModeMenu.tsx`, `ModelMenu.tsx`, `ContextUsageIndicator.tsx` under the same folder.
- **Plan mode UI** — `packages/ui/src/features/chat/messages/PlanCard.tsx` + `packages/ui/src/features/plan-panel/`. Plan-shaped assistant messages render via `PlanCard` (detected by `agentModeAtTurn === "plan"` — stamped on bubble creation from the composer store; falls back to the session's persisted mode for resumed sessions — plus a GFM `- [ ] / - [x]` checkbox in the body). The custom checkbox swap lives in `packages/ui/src/features/chat/markdown/CheckboxItem.tsx` and is wired into the shared `<Markdown>` component. The plan file lives at `${projectPath}/.pi-deck/plans/${sessionId}.md` and is watched by a dedicated host-side `PlanFileWatcher` (`packages/core/src/host/plan-file-watcher.ts`) — distinct from the file-tree watcher because it must react to *content-only* changes that `fs.tree.changed` deliberately ignores. The renderer subscribes via `EVENT_PLAN_FILE_CHANGED` ("plan.file.changed") and primes via the `plan.file.read` command. Plan-card footer is two controls (deliberately *not* a split-button): a secondary `ModeTargetPicker` pill that updates `usePlanStore.lastApproval` without approving, and a primary `Approve & execute` button that fires `session.approvePlan` with the persisted selection. Stale plans (any assistant turn that isn't the latest) hide the footer. Inline tool approvals (for `ask` mode and `accept-edits` allowlist misses) attach as `pendingApproval?` on the `ToolCallEntry` and render via `ApprovalPill` on the tool-call card, resolved through `session.toolApproval`. **`PlanPanel.tsx` is built and live-updates from the store but is not currently mounted** — the right-rail tab was removed pending a planned Context-tab integration that will surface "open plan file in file manager" + "download as markdown" affordances rather than its own tab.
- **Provider registry** — `packages/core/src/providers/` + `packages/core/src/host/provider-manager.ts`. Built-in providers come from pi-ai's `ModelRegistry`. Custom OpenAI-compatible providers are stored in `~/.config/pi-deck/providers.json` and materialised to `~/.pi/agent/models.json` (via `models-json.ts`) so pi's `ModelRegistry` picks them up natively. No pi extension is shipped.
- **Secrets** — API keys live in pi's `~/.pi/agent/auth.json` via the `AuthStorage` API (`packages/core/src/providers/auth-bridge.ts`). pi-deck never persists keys itself, never sends them to the renderer, and only materialises them at request time when pi's session resolves a provider. The renderer only ever sees an `AuthState` (`authenticated` / `needs-key` / `unreachable`).
- **Model picker** — `packages/ui/src/features/models/`. Opened from the chat header `ModelBadge` (a `PidChip`-style button on `ChatHeader.tsx`) or via the `ModelMenu` dropdown in the composer. `ModelPicker.tsx` portals a two-column modal (providers left, models right) using the `.pid-modal-backdrop` + `.pid-modal` chrome from `components.css`. Per-session model and thinking level are stored in pi-deck via `useProvidersStore.sessionSelection`, persisted to `providers.json`, and forwarded to the live worker via `session.setModel` / `session.setThinkingLevel` commands.
- **Usage tracking** — `packages/ui/src/features/chat/useUsageStore.ts` reads per-turn `usage` + `contextUsage` from `EVENT_SESSION_TURN_END`. Worker source: `packages/core/src/worker/agent-bridge.ts:forwardEvent` extracts `message.usage` and calls `session.getContextUsage()`. The per-category breakdown in `ContextUsageIndicator` is derived renderer-side from the messages store because pi's `ContextUsage` is aggregate-only.
- **Theme system** — `packages/ui/src/theme/`. Tokens defined in `tokens.css` using descriptive names (`--bg-0..3`, `--ink-0..3`, `--accent*`, `--add/del/mod`, `--diff-*`). Active theme is JSON, applied by `loader.ts` as inline custom properties on `<html>`. VS Code themes are imported via `vscode-adapter.ts`. Shiki bridge in `shiki-bridge.ts` keeps syntax highlighting aligned with the active theme. Six bundled palettes: default / phosphor / nightshade × dark / light. The canonical Zod schema lives in `packages/core/src/protocol/theme.ts` and is re-exported via `@pi-deck/core`.
- **Theme storage & hot reload** — `packages/core/src/host/themes/`. Bundled JSON lives in `packages/core/src/host/themes/bundled/` and is imported with `with { type: "json" }`. User themes live at `<userData>/themes/` (Electron `app.getPath("userData")`). Chokidar watches the dir and emits `theme.changed` events; if the active theme's spec changed on disk, the new spec ships in the event payload so the renderer re-applies without a round-trip.
- **Renderer prefs** — `packages/ui/src/theme/usePreferencesStore.ts`. Density (compact/cozy) and font-pair (default/sans-only/mono-only) live here, separate from theme. Persisted to localStorage under `pi-deck:prefs`. Hydrated pre-mount via the inline script in `packages/desktop/index.html` so the first paint matches the user's preference.
- **Settings UI** — `packages/ui/src/features/settings/`. Opens via Cmd/Ctrl+, (`useSettingsHotkey`) or the topbar gear (`PidTopBar`). Overlay state lives in `useSettingsStore` (open/section, not persisted). Appearance section is wired against `useThemeStore` / `usePreferencesStore`. Theme import uses the new `theme.import` host command + `bridge:openFile` IPC.
- **Nav store** — `packages/ui/src/lib/useNavStore.ts`. Single source of truth for which screen is in the center column (`overview | session | editor | git-diff | git-history`). Persists screen + per-project expand state to localStorage under `pi-deck:nav:v1`. Transient screens (editor/git-diff/git-history) coerce back to `session` on rehydrate. Settings stays a modal — it is not a nav route.
- **Intro screen** — `packages/ui/src/features/intro/`. `PidIntroScreen` renders the italic-serif hero, stub composer (bound to `useIntroComposerStore`), 6 static templates from `templates.ts`, and a recent-sessions strip. Fullscreen variant: empty-state landing when no project / no sessions exist. Inline variant: rendered inside the `session` route by `PidCenterRouter` when the active session has zero messages.
- **Sessions overview** — `packages/ui/src/features/sessions/overview/`. `PidSessionsOverview` is the default landing screen. Grouped by project from `useProjectsStore`, each section lazy-loads its sessions via `useSessionsStore.loadProjectSessions(projectId)`. Cards (`PidSessionCard`) link back to the session route.
- **Compact sessions rail** — `packages/ui/src/features/sessions/PidSessionsList.tsx` and friends (`PidSessionRow`, `PidProjectSwitcher`, `PidNewSessionButton`). Left-rail Sessions tab. Shares the same `sessionsByProject` cache as the overview. Project expand state lives in `useNavStore.expandedProjectsRail`. Rows render `session.branch` (snapshot taken at create time via `currentBranch`) under each title and accept right-click for Archive / Delete. Archived sessions are filtered out of their project group and aggregated into a synthetic `ARCHIVE` group at the bottom, populated by `useSessionsStore.loadArchivedSessions()` on mount.
- **Session persistence** — `packages/core/src/host/metadata-store.ts`. Per-project `metadata.json` now carries both the `Project` record and an optional `sessions` map (`SessionMetadata` per id: title, branch snapshot, archived flag, lastActivityAt, sessionFile). `SessionManager` calls `upsertSession` / `patchSession` / `deleteSession` / `renameSessionId` to keep the file in sync. On the first `session.list` per project, `SessionManager.rehydrateProject` builds stub records from the file so the rail paints prior sessions without spawning workers.
- **Session lifecycle commands** — `session.archive` / `session.unarchive` / `session.delete` / `session.listArchived` in `packages/core/src/protocol/commands.ts`. Archive flips the persisted flag and is reversible. Delete aborts the worker, removes the in-memory record, drops the session from `Project.sessionIds`, deletes pi's `sessionFile` from disk, and (in the UI) clears `activeSessionId` if it was the open session. The chat header has matching Archive + Delete buttons that drive the same store actions.
- **New-session shortcut** — `packages/ui/src/features/sessions/useNewSessionShortcut.ts`. Global Cmd/Ctrl+N. Suppressed inside editable elements. Mounted once in `App.tsx` alongside `useSettingsHotkey`.
- **Center router** — `packages/ui/src/layout/PidCenterRouter.tsx`. Reads `useNavStore.screen` and renders overview / session (chat or inline-intro) / editor / git-diff / git-history. Editor / diff / history are placeholders until their owning plans land.
- **Git** — `packages/core/src/git/`. All git operations go through `runner.ts` (no JS-git library). Repo detection via `detect.ts`, status via `status.ts`, recent commits via `log.ts`, file watching via `watcher.ts`, init via `init.ts`. Pure read-only display in v1 — no commit/push/pull/stage. The host orchestrates per-project watchers from `packages/core/src/host/git-watch-manager.ts`, broadcasting `git.status.changed` to the renderer.
- **Turn file tracking** — `packages/core/src/host/turn-tracker.ts`. Listens for `session.tool.call.end` events from the session manager and records the file path against the active session whenever a file-mutating tool (`write`, `edit`, `patch`, etc.) succeeds. In-memory only; cleared on `session.deactivate` and on worker exit. Consumed by the git sidebar (recent-touch dot on `ChangeRow`).
- **Git sidebar UI** — `packages/ui/src/features/git/`. Subscribes to `git.status.changed` / `git.turnTouches.changed` events via the renderer's event router. `GitSidebar` composes `BranchHeader` (Radix dropdown that runs checkout), `ChangesList` (flat list + diffbar), `RecentCommitsList`, and the `EmptyState` Init button. Per-project state lives in the existing `useGitStore` (extended with `statusByProject`, `commitsByProject`, `touchesBySession`).
- **Filesystem walker** — `packages/core/src/fs/`. Walker (`walker.ts`) + watcher (`watcher.ts`) feed the files-tab tree. Respects `.gitignore` + `.git/info/exclude`. CRUD ops in `ops.ts`; deletes go through `shell.trashItem` (injected from the desktop bridge via `setTrashImpl`) so they're recoverable from the OS trash. All paths validated against project root to block traversal. Per-project lifecycle owned by `packages/core/src/host/fs-watch-manager.ts`, which broadcasts `fs.tree.changed` deltas.
- **File tree UI** — `packages/ui/src/features/files/`. Virtualized tree (`@tanstack/react-virtual`), fuzzy filter (`fuse.js`). File-type icons reuse `iconForFile()` from `packages/ui/src/components/icons/file-icons.ts` (iconify + `material-icon-theme`) — the same mapping the git tab uses; folder rows use Lucide `Folder` / `FolderOpen`. Row chrome (chevrons, filter, status) still uses the existing 14×14 Glyph system. Drag payload uses the `application/x-pideck-paths` MIME and feeds into the composer attachment pipeline via `useComposerPathDrop` (shared by `MessageInput.tsx` and `PidComposerScreen.tsx`).

## App shell rules

- **Rails are drag-resizable.** Defaults are 264px left / 360px right; users can drag the boundary between rail and center (or center and right pane). Widths are clamped to 200–520px and persisted via `useRailState` (`packages/ui/src/layout/use-rail-state.ts`, localStorage key `pi-deck:rails`). The `--rail-w` and `--rightpane-w` CSS vars are driven by the store from `PidAppShell` so the topbar and body grids stay in sync.
- **Overlays must portal.** Every overlay-shaped component (`Dialog`, `DropdownMenu`, `ContextMenu`, `Tooltip`, command palette) renders into a `document.body` portal so it sits above the `.pid-app::before` grain (`z-index: 999`, `mix-blend-mode: overlay`). Non-portaled overlays render below the grain and look muddy.
- **The footer never shows a "screen switcher".** That's a tour helper in the design prototype, not production.
- **`packages/desktop/src/main/window.ts` controls native title bar config.** Don't change `titleBarStyle` or `titleBarOverlay` without re-verifying the topbar drag region on all three OSes.
- Extend `GlyphKind` in `packages/ui/src/components/glyph/kinds.tsx` for icon that is not available or not present in the lucide-react package. If an icon cannot be found then, then put a placeholder dot-grid and TODO it.

## Styling rules

- **Never hardcode colours.** Always use a CSS variable from `tokens.css`. Adding a colour means proposing a new token.
- **The token list is small on purpose.** If you find yourself reaching for "another shade of grey", reuse an existing surface token first.
- **VS Code theme compatibility is best-effort, not pixel-perfect.** Imported themes will look close, not identical. Don't add a token just to match a VS Code-specific colour key - map it to the closest existing token instead.
- **Shiki and pi-deck share the active theme.** When the active theme came from a VS Code JSON, Shiki uses that JSON directly. Otherwise it uses a curated bundled Shiki theme that matches our tokens.
- **Adding a token** requires updating every bundled theme JSON in `packages/core/src/host/themes/bundled/` AND adding a fallback to the VS Code adapter's translation table.
- **Compat aliases** (`--color-*` → `--bg-*`/`--ink-*`) in `tokens.css` are temporary. Remove each alias as the legacy file referencing it migrates.
- **First `Pid*` primitives** — `PidButton`, `PidIconButton`, `PidChip`, `PidKbd` in `packages/ui/src/components/{buttons,chip,kbd}/`. Style rules live in `packages/ui/src/theme/components.css`. Other primitives (inputs, selects, table rows) ship as later plans need them — no speculative scaffolding.
- **Radix wrappers preserved.** `Dialog`, `Tabs`, `Tooltip`, `DropdownMenu`, `ContextMenu`, `Spinner` keep their current implementation; restyle via className in later plans rather than rewriting. The previous `Button` / `IconButton` are renamed `Button.legacy.tsx` / `IconButton.legacy.tsx` — new code must use the `Pid*` primitives.

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
- **Content Security Policy.** In packaged builds the main process attaches a strict CSP via `session.defaultSession.webRequest.onHeadersReceived` (see `packages/desktop/src/main/security.ts`). No `'unsafe-eval'`; `connect-src` whitelists only `127.0.0.1`; `frame-ancestors 'none'`. In dev, Vite HMR requires `'unsafe-eval'` so we suppress Electron's security warning (the warning itself notes it never fires in packaged builds). Adding a new outbound origin requires editing `security.ts`.

## Adding a built-in provider

When pi adds a new built-in provider (or we choose to surface one that pi supports but we previously hid):

1. Add a `BuiltInProviderDef` entry to `BUILT_IN_PROVIDERS` in `packages/core/src/providers/built-ins.ts` with the right `authJsonKey` (matches pi's `~/.pi/agent/auth.json` key) and `envVar` (matches pi-ai's `env-api-keys.ts`).
2. Add a small monochrome `<svg>` glyph in `packages/ui/src/features/models/icons/index.tsx`.
3. Smoke-test by authenticating, picking a model, sending a prompt.

No code generation, no manifest dance. Adding a provider is a one-file change in the registry. Custom OpenAI-compatible endpoints don't need any of this — users add them at runtime via the picker.

## Acceptance gate for every change

Before opening a PR:

1. `bun run check` is green.
2. The change matches the file-by-file outline of the relevant plan.
3. AGENTS.md has been updated per the plan's "AGENTS.md updates" section.
4. The acceptance criteria from the plan are hand-verified.
