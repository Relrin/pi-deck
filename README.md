# pi-deck

A friendly desktop and web client for the [pi coding agent](https://github.com/earendil-works/pi). pi-deck embeds pi's `AgentSession` SDK and renders the result — it does not implement its own agent loop.

## Why use pi-deck?

- **Cross-platform** - The client is supported on Windows, Linux & MacOS
- **Familiarity** - Built on the top of the pi.dev  
- **Friendly interface** - Adapted for regular usage  

## Quick Start
Make sure that you have [Pi coding agent](https://pi.dev/) installed.

### **Desktop (macOS)**
Download from [Releases](https://github.com/relrin/pi-deck/releases).

## Development environment
- [Bun](https://bun.sh) (the version pinned in `package.json#packageManager`)
- Node.js 24 or newer (required for downstream tooling such as Electron and `node-pty`)

## Setup

```bash
bun install
bun run check
```

`bun run check` runs Biome (lint + format check) and TypeScript across every workspace. It must be green before any commit.

## Project structure & roadmap
Project conventions and architectural decisions live in [AGENTS.md](AGENTS.md).
