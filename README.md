# pi-deck

A friendly desktop client for the [pi coding agent](https://github.com/earendil-works/pi).

This application was developed to address my personal needs & workflows related to the usage of Pi coding agent. As one of the goals was to have a "lightweight" IDE, but with 
the focus on doing reviewing more efficient. A lot of inspiration comes from existing IDEs, however the intent was to keep relevant features that I use on a regular basis.

## Features

- **Familiar UI** - Multiple sessions support, project switcher, conversations with a support of attachments and drag'n'drop.
- **Pi-compatible** - Made with intent to be fully compatible with original Pi. That also includes being aware of session, created in Pi originally.
- **Plan mode support** - A custom extension, that allows to think through the problem together before proceeding to the implementation.
- **Tool calls approvals** - Control the interaction with certain tools globally & per session.
- **Cross-platform** - Windows, Linux and macOS (Apple Silicon + Intel) support with the same set of features.

## Quick start
Grab the latest installer for your OS from [releases](https://github.com/relrin/pi-deck/releases):

- **macOS** — `.dmg` or `.zip` (Apple Silicon and Intel)
- **Windows** — `.exe` installer or portable `.zip`
- **Linux** — `.AppImage` or `.deb`

You'll also need:
- [pi](https://pi.dev/) installed and signed in to at least one provider (`pi auth login ...`).
- [Git](https://git-scm.com/) on your `PATH` for the git sidebar.

pi-deck reads from pi's own data directory, so any sessions you've already created in pi show up as soon as you point pi-deck at the project.

## Building from source
To make it possible to build the app from sources you would need:
- [Bun](https://bun.sh) (the version pinned in `package.json#packageManager`)
- Node.js 24 or newer (required for downstream tooling such as Electron and `node-pty`)

After that, run a set of the following command to make sure that everything runs smoothly:
```bash
bun install
bun run check        # lint + format + type-check — must be green before commits
bun run tests        # full set of tests against an codebase
bun run desktop:dev  # run the Electron app in dev mode
```

`bun run check` is wired into the pre-commit hook via Husky. Don't disable it.

For more information I do recommend to look through the [AGENTS.md](AGENTS.md) file, because its contains relevant information about architecture, conventions, where data lives, etc. Please, read it before opening a PR.

## License
The pi-deck project is published under MIT license. For more details read the [LICENSE](https://github.com/Relrin/pi-deck/blob/master/LICENSE) file.
