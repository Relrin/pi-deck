# AGENTS.md

Canonical project handbook for pi-deck, read by both humans and AI coding agents.

## What pi-deck is

A friendly desktop and web client for the [pi coding agent](https://github.com/earendil-works/pi). pi-deck does not implement an agent loop itself. It embeds pi's `AgentSession` SDK and renders the result.

## Stack

- **Runtime:** Bun (package manager + script runner) and Node 24+ (for things Bun doesn't yet do well, like `node-pty`).
- **Language:** TypeScript everywhere. No JavaScript except generated config.
- **UI:** React 19 + Vite. CSS variables + Tailwind v4 for styling.
- **Desktop shell:** Electron.
- **Agent embedding:** `@earendil-works/pi-coding-agent` `AgentSession` API, one Node subprocess per active session.
- **Renderer & backend transport:** WebSocket over localhost. Same protocol works for the standalone web target.
- **Diffs:** `@pierre/diffs` (built on Shiki).
- **PTY:** `@lydell/node-pty` (native module, runs in the host / Electron main). Ships per-`(os, cpu)` prebuilt N-API binaries (no source compile), but only the build host's arch installs — so cross-arch packaging needs a native runner, which is why macOS releases are Apple-Silicon-only (see the release matrix). `node-pty` is a runtime fallback. Externalized in the main build + `asarUnpack`ed for packaging.
- **Terminal renderer:** `ghostty-web` (WASM) behind a single adapter.
- **Lint / format:** Biome.
- **Tests:** `bun test` for unit. Playwright for end-to-end (not wired yet).

## Repo layout

```
pi-deck/
├── packages/
│   ├── core/        Shared backend logic: session worker, protocol, git, fs, providers, extensions
│   ├── ui/          Shared React UI (components, stores, theme system)
│   └── desktop/     Electron main process + thin bootstrap
├── plans/           Numbered .md feature plans — execute in order
├── scripts/         Repo automation (release, version bump, etc.)
└── .github/         CI/CD workflows
```

## Where data lives

- **pi's own data:** sessions stay at pi's default location (`~/.pi/agent/sessions/`). pi-deck reads but does not edit these.
- **pi-deck data:** `~/.config/pi-deck/` (or platform equivalent via Electron's `app.getPath("userData")`):
  - `projects/<project-id>/metadata.json` — pi-deck's view of a project (display name, pinned sessions, last opened, sessions map) referencing pi session IDs.
  - `themes/` — installed JSON themes.
  - `providers.json` — custom provider endpoints (OpenRouter keys, LM Studio URL, etc.).
  - `settings.json` — global app preferences.
- **Provider data inside `~/.pi/`** — two documented exceptions where pi-deck writes inside pi's directory: `~/.pi/agent/models.json` (custom provider registry materialised via `models-json.ts`) and `~/.pi/agent/auth.json` (API keys via pi's `AuthStorage` API). Everywhere else, go through pi's API.

## Commands
The following list of commands are used during the regular development process

```bash
bun install           # All workspaces
bun run check         # Lint + format check + type-check (must be green before commit)
bun run lint
bun run type-check
bun run test
bun run desktop:dev   # Electron in dev mode
bun run build         # Production build
```

`bun run check` is wired into the pre-commit hook via Husky. Don't disable it.

## Conventions

### Language

- **TypeScript:** no `any`, no blind casts. If you have to escape the type system, leave a `// FIXME(types): why` comment.
- **Control flow:** prefer early returns over nested ternaries. Switch over chained `else if` for finite discriminated unions.

### React & state

- **Components:** function components + hooks. Class components only for error boundaries.
- **State:** Zustand for global stores. `useState`/`useReducer` for local. No Redux.
- **Stores:** one Zustand store per domain (`useXStore`). Stores expose actions and selectors; UI uses selectors only. Never mutate store state from outside the store's actions.

### Imports

- Absolute imports rooted at the package via tsconfig paths, not deep relative `../../..`.

### Styling

- Tailwind v4 utility classes. Custom CSS only for things Tailwind can't express (animations, complex grid).
- **Never hardcode colours.** Always reference CSS variables from `packages/ui/src/theme/tokens.css`. Adding a colour means proposing a new token.
- The token list is small on purpose — reuse an existing surface token before adding a new shade.
- VS Code theme compatibility is best-effort, not pixel-perfect. Map to the closest existing token rather than adding tokens to match VS Code-specific keys.
- Compat aliases (`--color-*` → `--bg-*`/`--ink-*`) in `tokens.css` are temporary. Remove each alias as the legacy file referencing it migrates.

### File & symbol naming

- kebab-case for files, PascalCase for React components (`SessionsList.tsx`), camelCase for hooks (`useSessions.ts`).

### Markdown rendering

- Route all assistant text through the chat `Markdown` component (`packages/ui/src/features/chat/messages/Markdown.tsx`). It owns Shiki highlighting, autolinking, and the GFM dialect. Don't render raw markdown ad-hoc.

### Icons

- Import from `packages/ui/src/components/icons` only. This is the swap point if we change icon libraries.
- Extend `GlyphKind` in `packages/ui/src/components/glyph/kinds.tsx` for icons not present in `lucide-react`. If an icon cannot be found, drop in a dot-grid placeholder and `TODO` it.
- **File-type icons** come from `@pierre/trees`' built-in set, for parity with the file tree. The tree renders them itself; light-DOM surfaces (the git sidebar's `ChangeRow`) use `PidPierreFileIcon` (`packages/ui/src/components/icons/PidPierreFileIcon.tsx`), which resolves the path → sprite symbol and colours it via `theme/pierre-file-icons.css` (Pierre's palette, vendored + scoped to `.pid-pierre-icon`; re-extract on upgrade). The old `iconForFile` + `@iconify-json/material-icon-theme` mapping was removed.

### Git operations

- All go through `packages/core/src/git/runner.ts`. Direct spawning of `git` elsewhere is forbidden. Errors are typed (`GitNotFoundError`, `NotARepoError`, `GitCommandError`).

### Dependencies

- Pin exact versions (no `^` / no `~`) in every `package.json`. The lockfile (`bun.lock`) must travel in the same commit as any dependency change.
- Avoid adding dependencies without a clear reason — especially anything that adds a transitive native module, since those slow down install and Electron packaging.

### Logging

- No `console.log` in committed code. Use the structured logger.

### Testing

- Unit tests run on `bun test`. `mock.module` is **process-global and can't be reverted** — a module one test file mocks stays mocked for every later file in the run, and `bun test`'s file order differs by OS (sorted on Windows, readdir on Linux/CI), so an order-dependent leak can pass locally yet fail in CI. Mock the narrowest seam; if a test needs the *real* module that a sibling test mocks, import a fresh, separately-keyed copy with a cache-busting query — `(await import(`${path}?real`))` — see `packages/ui/test/features/terminal/TerminalRenderer.theme.test.ts`.

## Do not

- Modify pi's source or wrap its protocol in incompatible ways. We are building *client* on the top of original Pi, not a fork.
- Add MCP support. pi doesn't have it and we don't either. (If a user wants MCP, they can install or write our own a pi extension.)
- Touch `~/.pi/` directly except for the two documented provider files (see *Where data lives*). Everywhere else, go through pi's API.
- Log API keys, OAuth tokens, or session content to disk outside the documented locations. Never log provider credentials in any form — even truncated.
- Send API keys to the renderer. The renderer can request "is provider X authenticated?" but the secret itself stays in the host.
- Hardcode model IDs anywhere outside `packages/core/src/providers/`. The registry is the only place that knows model strings; the UI fetches them through `provider.models`.
- Expose raw LSP methods to the renderer without the host-side allowlist in `packages/core/src/lsp/server-defs.ts`. New methods must be added there explicitly.

## Architecture overview

- **Three processes.** Electron main (host), BrowserWindow (renderer), one Node subprocess per active session (worker). Worker is spawned in production via `process.execPath` with `ELECTRON_RUN_AS_NODE=1`.
- **Renderer & host transport.** WebSocket bound to `127.0.0.1` only, authenticated with a per-launch token surfaced through the preload bridge. Protocol is versioned (`packages/core/src/protocol/version.ts`); renderer and host always ship together.
- **Host & worker transport.** LF-delimited JSONL on stdio. Internal and unversioned — workers are spawned from the same binary so they're always in sync.
- **Provider system.** Built-in providers come from pi-ai's `ModelRegistry`. Custom OpenAI-compatible providers are stored in `~/.config/pi-deck/providers.json` and materialised to `~/.pi/agent/models.json` so pi picks them up natively. Secrets live in pi's `~/.pi/agent/auth.json` via `AuthStorage` — never copied into pi-deck's directories or the renderer.

## App shell rules

- **Rails are drag-resizable.** Defaults are 264px left / 360px right; users drag the boundary between rail and center (or center and right pane). Widths are clamped 200–520px and persisted via `useRailState` (`packages/ui/src/layout/use-rail-state.ts`, localStorage key `pi-deck:rails`). The `--rail-w` and `--rightpane-w` CSS vars are driven by the store from `PidAppShell` so the topbar and body grids stay in sync.
- **Overlays must portal.** Every overlay-shaped component (`Dialog`, `DropdownMenu`, `ContextMenu`, `Tooltip`, command palette) renders into a `document.body` portal so it sits above the `.pid-app::before` grain (`z-index: 999`, `mix-blend-mode: overlay`). Non-portaled overlays render below the grain and look muddy.
- **The footer never shows a "screen switcher".** That's a tour helper in the design prototype, not production.
- `packages/desktop/src/main/window.ts` controls native title bar config. Don't change `titleBarStyle` or `titleBarOverlay` without re-verifying the topbar drag region on all three OSes.

## Subsystems

Append new entry points under the matching sub-heading. Keep entries to one line plus a path; multi-paragraph implementation notes belong in code comments, not here.

### Workspace & build

- **Root configs** — `package.json`, `tsconfig.base.json`, `biome.json`, `bunfig.toml`. All commands flow through Bun.
- **Pre-commit hook** — `.husky/pre-commit` runs `bun run check`.
- **CI/CD** — `.github/workflows/ci.yml` (PR gate) and `.github/workflows/release.yml` (tag-triggered electron-builder matrix: Windows x64, Linux x64, macOS arm64). Release versioning via `scripts/version.ts`.
- **Electron packaging** — `packages/desktop/electron-builder.yml`.

### Electron shell

- **Main process** — `packages/desktop/src/main/`. Dev: `bun run desktop:dev`. Build: `bun run --filter @pi-deck/desktop dist`. Window bounds persist to `userData/window-state.json`.
- **Preload bridge** — `packages/desktop/src/preload/`. The renderer's only path to anything OS-level. `window.bridge.connect()` returns `{ url, token }` for the host WS.
- **Security policy** — `packages/desktop/src/main/security.ts` attaches the strict CSP in packaged builds. Adding a new outbound origin requires editing this file.

### Protocol & transport

- **Protocol schemas** — `packages/core/src/protocol/`. `Frame`, `Command`, event topic types and zod schemas. Protocol version constant in `version.ts`. Any new command or event updates this folder.
- **Transport client (renderer)** — `packages/ui/src/lib/transport/`. WS client + typed protocol client. All renderer-side calls to the host go through here.
- **Event router** — `packages/ui/src/lib/transport/event-router.ts`. The single `routeEvent` function is the only event subscriber and dispatches into the stores.

### Host services

- **Host entry** — `packages/core/src/host/`. Owns the WS server, session manager, and metadata store. Entry: `startHost()`. Auth token is generated per app launch and passed via the preload bridge.
- **Session persistence** — `packages/core/src/host/metadata-store.ts`. Per-project `metadata.json` carries the `Project` record and a `sessions` map (`SessionMetadata` per id: title, branch snapshot, archived flag, lastActivityAt, sessionFile). `SessionManager.rehydrateProject` builds stub records on first `session.list` so the rail paints without spawning workers.
- **Plan file watcher** — `packages/core/src/host/plan-file-watcher.ts`. Watches `${projectPath}/.pi-deck/plans/${sessionId}.md`; emits `EVENT_PLAN_FILE_CHANGED`. Distinct from the fs-tree watcher because it must react to content-only changes that `fs.tree.changed` deliberately ignores.
- **Git watch manager** — `packages/core/src/host/git-watch-manager.ts`. Per-project watchers broadcasting `git.status.changed`.
- **FS watch manager** — `packages/core/src/host/fs-watch-manager.ts`. Broadcasts `fs.tree.changed` deltas.
- **Turn tracker** — `packages/core/src/host/turn-tracker.ts`. Records file paths against the active session whenever a file-mutating tool succeeds (in-memory; cleared on `session.deactivate` and worker exit). Consumed by the git sidebar's recent-touch dot.
- **Artefacts tracker** — `packages/core/src/host/artefacts-tracker.ts`. Narrower than the turn tracker — only fires for `write` / `create` / `create_file` / `file_write`, and uses an `existsBefore` snapshot on tool-call start to filter out edits of existing files. Emits `session.artefacts.changed`.
- **Theme storage** — `packages/core/src/host/themes/`. Bundled JSON in `bundled/`; user themes at `<userData>/themes/`. Chokidar emits `theme.changed`; if the active theme's spec changed on disk, the new spec ships in the event payload so the renderer re-applies without a round-trip. VS Code colour themes are translated to a full pi-deck `ThemeSpec` via `vscode-adapter.ts` on disk-read (the raw VS Code JSON is preserved so Shiki can use it directly).
- **Provider manager** — `packages/core/src/host/provider-manager.ts`. Orchestrates `packages/core/src/providers/`.

### Worker

- **Session worker** — `packages/core/src/worker/`. One Node subprocess per active session, hosting pi's `AgentSession`. Bundled to `packages/desktop/dist/worker.js`.
- **Agent bridge** — `packages/core/src/worker/agent-bridge.ts`. `forwardEvent` extracts `message.usage` and calls `session.getContextUsage()` for usage events.

### Providers & secrets

- **Registry** — `packages/core/src/providers/`. Built-ins come from pi-ai's `ModelRegistry`. Custom OpenAI-compatible providers materialise to `~/.pi/agent/models.json` via `models-json.ts`.
- **Auth bridge** — `packages/core/src/providers/auth-bridge.ts`. API keys live in pi's `~/.pi/agent/auth.json` via `AuthStorage`. pi-deck never persists keys itself, never sends them to the renderer, and only materialises them at request time when pi's session resolves a provider. The renderer only ever sees an `AuthState` (`authenticated` / `needs-key` / `unreachable`).

### App shell & layout

- **Shell components** — `packages/ui/src/layout/PidAppShell.tsx` (+ `PidTopBar`, `PidBody`, `PidLeftRail`, `PidRightPane`, `PidFooter`). Layout CSS in `packages/ui/src/theme/shell.css`. Resizable rails per *App shell rules*. The previous shell is preserved at `packages/ui/src/layout/AppShell.legacy.tsx` (+ siblings) and is unwired.
- **Center router** — `packages/ui/src/layout/PidCenterRouter.tsx`. Reads `useNavStore.screen` and renders overview / session (chat or inline-intro) / editor / git-diff. The `editor` screen renders the CodeMirror editor (see *Code editor*); `git-diff` the diff view.
- **Nav store** — `packages/ui/src/lib/useNavStore.ts`. Single source of truth for the center screen + per-project expand state. Persists under `pi-deck:nav:v1`. Transient screens coerce back to `session` on rehydrate. Settings stays a modal — it is not a nav route.

### Chat

- **Root** — `packages/ui/src/features/chat/`. `ChatView` owns `MessageList` + `MessageInput`. Messages live in `useMessagesStore` keyed by session id.
- **Composer state** — `packages/ui/src/features/chat/composer/useComposerStore.ts` (persisted Zustand under `pi-deck:composer`) holds the execution mode. Model + thinking level moved to `useProvidersStore` (per-session). Bottom-bar controls: `ExecutionModeMenu.tsx`, `ModelMenu.tsx`, `ContextUsageIndicator.tsx`.
- **Image attachments** — clipboard paste (Ctrl/Cmd+V), drag-drop, and an "Attach image…" popover entry stage images alongside file/folder chips. Pipeline in `packages/ui/src/features/chat/composer/useImagePaste.ts` (paste/drop, 10 MB cap, 256 px thumbnail via OffscreenCanvas); lightbox at `ImagePreviewDialog.tsx`. Full bytes travel via `SessionPromptRequest.images`; only the downscaled thumbnail is persisted onto `UserMessageEntry.images`. Filesystem-sourced images flow through `window.bridge.readImage(path)` (Electron main IPC at `bridge:readImage`).
- **MessageList auto-scroll** — pin to latest uses `virtualizer.scrollToIndex(last, { align: "end" })`, not `el.scrollTop = el.scrollHeight` (the latter lands above the real bottom because `@tanstack/react-virtual` reports a stale `getTotalSize()` before dynamic rows are measured). The raw `scrollTop` write is reserved for restoring a saved offset.
- **Tool-call rendering** — `packages/ui/src/features/chat/tools/`. Renderers register into `ToolRendererRegistry` via `registerToolRenderer(name, component)`. Built-in renderers cover all pi default tools.
- **Markdown extensions** — `packages/ui/src/features/chat/markdown/CheckboxItem.tsx`. Swaps GFM checkboxes into the shared `<Markdown>` component (powers plan-mode checklists).
- **Message context menu** — `packages/ui/src/features/chat/messages/MessageContextMenu.tsx`. Radix `ContextMenu`. Actions: Copy text, Copy as Markdown, Attach selection to next prompt (via `useDraftStore`). Tool-call cards are intentionally not selectable.

### Sessions & projects

- **Overview** — `packages/ui/src/features/sessions/overview/`. `PidSessionsOverview` is the default landing screen; sections lazy-load via `useSessionsStore.loadProjectSessions(projectId)`. Cards (`PidSessionCard`) link back to the session route.
- **Rail** — `packages/ui/src/features/sessions/PidSessionsList.tsx` and friends (`PidSessionRow`, `PidProjectSwitcher`, `PidNewSessionButton`). Project expand state lives in `useNavStore.expandedProjectsRail`. Rows render `session.branch` (snapshot taken at create time via `currentBranch`) and accept right-click for Archive / Delete. Archived sessions aggregate into a synthetic `ARCHIVE` group at the bottom via `loadArchivedSessions()`.
- **Stores** — `useProjectsStore`, `useSessionsStore`, `useMessagesStore` under `packages/ui/src/features/sessions/` and `packages/ui/src/features/chat/`.
- **Lifecycle commands** — `session.archive` / `session.unarchive` / `session.delete` / `session.listArchived` in `packages/core/src/protocol/commands.ts`. Delete aborts the worker, removes the in-memory record, drops the session from `Project.sessionIds`, deletes pi's `sessionFile` from disk, and clears `activeSessionId` in the UI if it was the open session.
- **New-session shortcut** — `packages/ui/src/features/sessions/useNewSessionShortcut.ts`. Global Cmd/Ctrl+N, suppressed inside editable elements. Mounted once in `App.tsx`.

### Plan mode

- **PlanCard** — `packages/ui/src/features/chat/messages/PlanCard.tsx`. Renders plan-shaped assistant messages, detected by `agentModeAtTurn === "plan"` (stamped on bubble creation from the composer store; falls back to the session's persisted mode for resumed sessions) plus a GFM `- [ ] / - [x]` checkbox in the body. Footer is two controls (deliberately not a split-button): a `ModeTargetPicker` pill that updates `usePlanStore.lastApproval` without approving, and a primary `Approve & execute` button that fires `session.approvePlan` with the persisted selection. Stale plans (any assistant turn that isn't the latest) hide the footer.
- **PlanPanel** — `packages/ui/src/features/plan-panel/PlanPanel.tsx`. Built and live-updates from the store but **not currently mounted** — slated for Context-tab integration with "open in file manager" + "download as markdown" affordances.
- **Approval pills** — inline tool approvals (for `ask` mode and `accept-edits` allowlist misses) attach as `pendingApproval?` on `ToolCallEntry` and render via `ApprovalPill` on the tool-call card, resolved through `session.toolApproval`.

### Models & providers UI

- **Model picker** — `packages/ui/src/features/models/`. Opened from the chat-header `ModelBadge` (a `PidChip`-style button on `ChatHeader.tsx`) or the composer's `ModelMenu`. `ModelPicker.tsx` portals a two-column modal (providers left, models right) using `.pid-modal-backdrop` + `.pid-modal` chrome from `components.css`.
- **Per-session selection** — `useProvidersStore.sessionSelection` stores model + thinking level, persisted to `providers.json`, forwarded to the live worker via `session.setModel` / `session.setThinkingLevel` commands.
- **Usage tracking** — `packages/ui/src/features/chat/useUsageStore.ts` reads per-turn `usage` + `contextUsage` from `EVENT_SESSION_TURN_END`. The per-category breakdown in `ContextUsageIndicator` is derived renderer-side from the messages store because pi's `ContextUsage` is aggregate-only.

### Context tab

- **Tab** — `packages/ui/src/features/context/`. Right-pane tab surfacing (1) the segmented context-window bar driven by `contextBreakdown.ts` (shared with the composer's `ContextUsageIndicator` ring tooltip), (2) "in scope" — deduped attachments aggregated from `UserMessageEntry.attachments` in the current session, (3) "artefacts produced" — `useArtefactsStore` rows plus the session's plan-mode markdown when present. Row actions route to `window.bridge.openPath` (system default app) and `window.bridge.showItemInFolder` (reveal in file manager).

### Themes & preferences

- **Tokens** — `packages/ui/src/theme/tokens.css`. Descriptive names (`--bg-0..3`, `--ink-0..3`, `--accent*`, `--add/del/mod`, `--diff-*`).
- **Loader & Shiki bridge** — `packages/ui/src/theme/loader.ts` applies the active theme as inline custom properties on `<html>`. `shiki-bridge.ts` keeps syntax highlighting aligned: when a VS Code theme is active the bridge feeds Shiki the original VS Code JSON for key-for-key tokenisation; otherwise it picks a bundled Shiki theme by light/dark kind.
- **Bundled palettes** — six: default / phosphor / nightshade × dark / light. Canonical Zod schema lives in `packages/core/src/protocol/theme.ts` and is re-exported via `@pi-deck/core`.
- **Renderer prefs** — `packages/ui/src/theme/usePreferencesStore.ts`. Density (compact/cozy) and font-pair (default/sans-only/mono-only). Persisted to localStorage under `pi-deck:prefs`. Hydrated pre-mount via the inline script in `packages/desktop/index.html` so the first paint matches the user's preference.

### Settings UI

- **Overlay** — `packages/ui/src/features/settings/`. Opens via Cmd/Ctrl+, (`useSettingsHotkey`) or the topbar gear (`PidTopBar`). State in `useSettingsStore` (open/section, not persisted). Appearance section wired against `useThemeStore` / `usePreferencesStore`. Theme import uses the `theme.import` host command + `bridge:openFile` IPC.

### Intro

- **Screens** — `packages/ui/src/features/intro/`. Two near-identical surfaces share the `templates.ts` set: **`PidComposerScreen`** is the `blank` route (and the no-active-session fallback) wired by `PidCenterRouter`; **`PidIntroScreen`** is the empty-state landing (`PidSessionsOverview`, `variant="fullscreen"`) and the inline empty-session view (`variant="inline-empty-session"`). Both render the hero/composer (bound to `useIntroComposerStore`), 6 template cards, and a recents strip. NB: the `blank` route is `PidComposerScreen`, NOT `PidIntroScreen` — changes to the template cards must be made in **both** components.
- **Editable templates** — defaults live in `templates.ts`; per-id overrides (title / blurb / body) persist via `useTemplatesStore` (localStorage `pi-deck:templates:v1`) and merge through `resolveTemplate`. Implemented in **both** `PidComposerScreen` and `PidIntroScreen`. Each card opens `EditTemplateDialog` two ways: a hover-revealed pencil button (`.pid-composer-template-edit` / `.pid-intro-template-edit`, the reliable primary affordance — a real sibling button, not nested in the card) and a right-click `ContextMenu` ("Edit template…" / "Reset to default" when overridden). The 6 slots are fixed — no add/remove.

### Git

- **Operations** — `packages/core/src/git/`. All git operations go through `runner.ts` (no JS-git library). Repo detection via `detect.ts`, status via `status.ts`, recent commits via `log.ts`, file watching via `watcher.ts`, init via `init.ts`. `files.ts` `fileAtHead` (command `git.fileBaseline`) returns a path's HEAD contents — the code editor's diff-gutter baseline; `null` for untracked / non-repo.
- **Sidebar UI** — `packages/ui/src/features/git/`. Subscribes to `git.status.changed` / `git.turnTouches.changed`. `GitSidebar` composes `BranchHeader` (Radix dropdown that runs checkout), `ChangesList` (flat list + diffbar), `RecentCommitsList`, and the `EmptyState` Init button. Per-project state extends `useGitStore` with `statusByProject`, `commitsByProject`, `touchesBySession`.

### Filesystem

- **Walker & watcher** — `packages/core/src/fs/`. Walker (`walker.ts`) + watcher (`watcher.ts`) feed the files-tab tree. The fs watcher is **retained on purpose** — it keeps the tree live while the agent mutates files mid-turn (Pierre doesn't poll disk; the renderer pushes watcher deltas into the model). Respects `.gitignore` + `.git/info/exclude`. CRUD ops in `ops.ts` (`createFile` / `createFolder` / `rename` / `move` / `trashPaths`); deletes go through `shell.trashItem` (injected from the desktop bridge via `setTrashImpl`). All paths validated against project root to block traversal. The code editor reads/writes file *contents* via `ops.ts` `readTextFile` / `writeTextFile` (commands `fs.readFile` / `fs.writeFile`): `readTextFile` detects EOL, strips a UTF-8 BOM, LF-normalises, and flags binary (NUL sniff) / oversized files; `writeTextFile` re-applies the stored EOL.
- **File tree UI** — `packages/ui/src/features/files/`. Rendered by **`@pierre/trees`** (`PidFileTree.tsx` builds a `useFileTree` model; the library owns rendering, virtualization, keyboard nav, search, file-type icons, inline rename, and in-tree drag-to-move). pi-deck is the data feed + glue: `useFileTreeStore` loads the host walk and applies watcher deltas, `pierreTreeAdapters.ts` flattens `FsNode[]` → path list / maps git status to `setGitStatus` / bridges the theme via `themeToTreeStyles`, and mutations route to the host (`fs.rename` / `fs.move` / `fs.createFile` / `fs.createFolder` / `fs.delete`). The row context menu (`PidTreeContextMenu`) and filter input (`PidTreeSearch`, backed by Pierre search — not `fuse.js`) are pi-deck-styled; the "Attach to chat" action feeds the composer attachment pipeline (`application/x-pideck-paths` MIME via `useComposerPathDrop`, shared by `MessageInput.tsx` and `PidComposerScreen.tsx`).

### Code editor

- **Editor view** — `packages/ui/src/features/editor/`. A real, editable **CodeMirror 6** editor on nav screen `editor`. `PidEditorView` composes the tab strip (`PidEditorTabBar`), styled breadcrumb (`PidEditorBreadcrumb`), and the `CodeMirrorEditor` host. Files open from a single-click in the file tree (`PidFileTree`'s `onSelectionChange` → `useEditorStore.openFile` + `setScreen("editor")`).
- **State** — `useEditorStore.ts`: open tabs + active id + per-tab content/baseline/eol/dirty/cursor/readOnly/indent. Loads via `fs.readFile` + `git.fileBaseline`; saves via `fs.writeFile` (Ctrl/Cmd+S). The store holds tab metadata only — CodeMirror `EditorState`s are cached per tab inside `CodeMirrorEditor` so switching tabs preserves undo history, selection, and scroll.
- **Theme + highlighting** — `editorTheme.ts` maps CodeMirror chrome + a `HighlightStyle` (lezer tags) onto theme tokens, so syntax colours track the active pi-deck theme (the `dark` flag is reconfigured via a compartment on light/dark flips). Languages by extension in `languages.ts` (also the tab type-badge).
- **Diff gutter** — `diffExtension.ts` paints live add/mod/del line tints against the git HEAD baseline using `@codemirror/merge`'s `Chunk` diff primitive (no inline-original merge UI). Recomputes as you type; `null` baseline (untracked / no repo) shows no tints. Hovering a block's gutter thickens its bar; *clicking* the gutter opens a pinned floating toolbar (`PidDiffBlockToolbar`) — prev/next change, revert-block (undoable buffer edit via `revertDiffChunk`), open-in-Diff — dismissed on outside-click / Escape / scroll / edit / tab switch. Inline per-block commit is deferred — it needs hunk-level git staging.
- **Status bar** — `PidEditorStatus.tsx`, rendered in `PidFooter` only on the `editor` screen: cursor Ln/Col + selection, indentation, UTF-8, LF/CRLF, language.

### UI primitives

- **`Pid*` primitives** — `PidButton`, `PidIconButton`, `PidChip`, `PidKbd` in `packages/ui/src/components/{buttons,chip,kbd}/`. Style rules in `packages/ui/src/theme/components.css`. Other primitives (inputs, selects, table rows) ship as later plans need them — no speculative scaffolding.
- **Radix wrappers** — `Dialog`, `Tabs`, `Tooltip`, `DropdownMenu`, `ContextMenu`, `Spinner` keep their current implementation; restyle via className rather than rewriting. Previous `Button` / `IconButton` are renamed `Button.legacy.tsx` / `IconButton.legacy.tsx` — new code must use the `Pid*` primitives.

### Terminal

- **Backend** — `packages/core/src/terminal/`. `TerminalManager` (`index.ts`) owns the live PTYs (one per `terminalId`) in the host / Electron main, independent of pi sessions; `pty.ts` loads `@lydell/node-pty` (fallback `node-pty`); `shells.ts` does OS-aware shell detection (Windows pwsh/PowerShell/Git Bash/cmd with PATHEXT + WSL handling; macOS/Linux from `$SHELL` + defaults); `buffer.ts` is a byte-capped output ring for repaint. Output is batched (~8 ms) and flow-controlled (`pause`/`resume` past a high-water mark, with a `[output throttled]` hint). `terminal.*` commands route through `host/router.ts`; `terminal.output` / `terminal.exit` events broadcast like any other. `shutdownAll()` (called from `host.close()`) kills every PTY on quit — no zombies.
- **UI** — `packages/ui/src/features/terminal/`. A toggleable, vertically-resizable **bottom dock** (`TerminalDock` → `TerminalPane` → `TerminalView`), not a main-panel tab. `TerminalRenderer.ts` is the ghostty-web adapter; `terminalOutput.ts` is a pub/sub that writes PTY bytes straight into the emulator (bypassing React state); `useGhosttyTheme.ts` maps the active pi-deck theme to the emulator palette. Toggle via the left-rail Terminal button or `Ctrl/⌘+\``. Panel open/height + isolated tab set persist **per pi-deck session** (`useTerminalStore`, runtime `terminalId` stripped on persist). New terminals open in the active session's project root, inheriting its git branch. Settings live in `features/settings/sections/TerminalSection.tsx` + `useTerminalSettingsStore`.
- **Deferred:** pi ↔ terminal chat mirroring (a follow-up; plan-mode behaviour will be mirror-read-only + approve in the chat PlanCard).

### Language servers (LSP)

- **Host manager** — `packages/core/src/lsp/`. `LanguageServerManager` (`manager.ts`) spawns one server per `(projectId, serverId)` in the host, JSON-RPC over stdio (`vscode-jsonrpc`). Nothing is bundled: servers are detected on PATH (`environment.ts`, async probes, cached per app run); projects rooted at `\\wsl.localhost\<distro>` detect and spawn *inside* the distro via `wsl.exe -d <distro> -- sh -lc`. Idle-GC'd after the last `didClose`; restarted transparently when a reloaded renderer re-initializes; `shutdownAll()` runs from `host.close()` — no orphans.
- **Protocol passthrough** — `lsp.status` / `lsp.ensure` / `lsp.request` / `lsp.notify` / `lsp.shutdown` commands + `lsp.message` / `lsp.diagnostics` / `lsp.serverStatus` events (`packages/core/src/protocol/lsp.ts`). The renderer's `@codemirror/lsp-client` owns the LSP session (initialize handshake, document sync); the host is a method-**allowlisted** pipe that pins `rootUri`/`workspaceFolders` on the in-flight `initialize` and intercepts `$/cancelRequest` (host request ids differ from the renderer's). URIs stay server-form end to end; the renderer maps deck paths ↔ URIs via `packages/core/src/lsp/uri.ts` using the `mapping` from `lsp.ensure`.
- **CodeMirror client** — `packages/ui/src/features/editor/lsp/`. `useLspStore` lazily ensures a server per tab language and owns the `LSPClient`s; the per-tab `lspCompartment` (`extension.ts`) swaps built-in completion ↔ the LSP feature set (server completion, hover, signature help, `@codemirror/lint` diagnostics + gutter, rename/definition/references keymaps). `workspace.ts` routes cross-file go-to-definition into `useEditorStore.openFile`. Missing server → footer hint + Settings → Editor install hint; crash → one notification, silent fallback to built-in completion. Per-server enable toggles persist in `useLspSettingsStore` (localStorage).

## Protocol stability

The renderer & host protocol is versioned (`packages/core/src/protocol/version.ts`). When you change a command or event payload shape:

1. Bump the protocol version.
2. Update the schema in `protocol/frames.ts` or sibling files.
3. The renderer sends the version on connect; the host rejects mismatches with a clear error. This means renderer and host must always ship together (no skew across an auto-update).
4. The host & worker stdio protocol is internal and unversioned — workers are spawned from the same binary so they're always in sync.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer never has direct Node access. Anything OS-level goes through the preload bridge.
- A localhost-only WebSocket is the renderer ↔ backend transport. The server binds to `127.0.0.1` only and authenticates with a short-lived token generated at app start.
- No remote content loaded into the main BrowserWindow. External links open in the OS browser via `shell.openExternal`.
- **Content Security Policy.** In packaged builds the main process attaches a strict CSP via `session.defaultSession.webRequest.onHeadersReceived` (`packages/desktop/src/main/security.ts`). No `'unsafe-eval'`; `connect-src` whitelists only `127.0.0.1`; `frame-ancestors 'none'`. Vite HMR needs `'unsafe-eval'` in dev so we suppress Electron's security warning (the warning itself notes it never fires in packaged builds). Adding a new outbound origin requires editing `security.ts`.

## Adding things

### Adding a built-in provider

When pi adds a new built-in provider (or we surface one that pi supports but we previously hid):

1. Add a `BuiltInProviderDef` entry to `BUILT_IN_PROVIDERS` in `packages/core/src/providers/built-ins.ts` with the right `authJsonKey` (matches pi's `~/.pi/agent/auth.json` key) and `envVar` (matches pi-ai's `env-api-keys.ts`).
2. Add a small monochrome `<svg>` glyph in `packages/ui/src/features/models/icons/index.tsx`.
3. Smoke-test by authenticating, picking a model, sending a prompt.

No code generation, no manifest dance. Custom OpenAI-compatible endpoints don't need any of this — users add them at runtime via the picker.

### Adding a theme token

1. Add the token to every bundled theme JSON in `packages/core/src/host/themes/bundled/`.
2. Add a fallback to the VS Code adapter's translation table in `packages/core/src/host/themes/vscode-adapter.ts` so imported themes still resolve.

### Adding a tool renderer

1. Create a component under `packages/ui/src/features/chat/tools/`.
2. Call `registerToolRenderer(name, component)` so it lands in `ToolRendererRegistry`.

## Validation

Before opening a PR:

1. **`bun run check` is green** — lint, format, and type-check. The pre-commit hook already runs this; don't bypass it.
2. **Plan alignment** — the change matches the file-by-file outline of the relevant plan.
3. **Acceptance criteria are hand-verified.** CI green is necessary but not sufficient.
4. **Dependency hygiene** — any new dependency is pinned exact-version (no `^` / no `~`), and `bun.lock` is committed in the same change.
5. **Stage explicit paths.** When concurrent agent sessions are plausible, prefer `git add <path>` over `git add .` so an unrelated worktree change doesn't slip into the commit.
