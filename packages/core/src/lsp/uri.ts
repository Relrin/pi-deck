/**
 * Deck-path to file-URI translation for the LSP passthrough.
 *
 * A "deck path" is the POSIX-normalised absolute path the rest of pi-deck uses (fs walker,
 * editor tabs): `C:/Code/proj/src/a.ts`, `/home/user/proj/a.ts`, or — for projects living inside
 * WSL — the UNC form `//wsl.localhost/<distro>/home/u/proj/a.ts`.
 *
 * Language servers never see deck paths. They see "server-form" URIs: the path as it exists in
 * the environment the server runs in (`file:///home/user/proj/a.ts` inside a distro,
 * `file:///c%3A/Code/proj/src/a.ts` for a local Windows server). All passthrough traffic stays
 * server-form end to end; only the renderer converts at the editor boundary, using the
 * `LspMapping` descriptor returned by `lsp.ensure`.
 *
 * URI shape mirrors vscode-uri's output for the common cases (lowercase drive letter, `:`
 * escaped as `%3A`, segment-wise percent-encoding) so URIs we generate compare equal to the
 * ones servers built on vscode-languageserver-node generate themselves.
 */

export type LspMapping = { kind: "local" } | { kind: "wsl"; distro: string };

export interface WslRoot {
  distro: string;
  /** Absolute POSIX path inside the distro ("/" when the share root itself was given). */
  guestPath: string;
}

/** Canonical POSIX form: forward slashes, no trailing slash (the bare root stays "/"). */
export function toPosixPath(path: string): string {
  const trimmed = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** Matches both UNC spellings Windows exposes for WSL shares, in native or POSIX-normalised form. */
const WSL_ROOT_RE = /^\/\/(?:wsl\$|wsl\.localhost)\/([^/]+)(\/.*)?$/i;

/** Parse a WSL UNC path (`\\wsl$\<distro>\...` / `\\wsl.localhost\<distro>\...`) or null. */
export function parseWslRoot(path: string): WslRoot | null {
  const m = WSL_ROOT_RE.exec(toPosixPath(path));
  if (!m?.[1]) return null;
  return { distro: m[1], guestPath: m[2] ?? "/" };
}

function encodePathForUri(posixPath: string): string {
  return posixPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function decodeUriPath(path: string): string {
  return path
    .split("/")
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    })
    .join("/");
}

/**
 * Deck path → server-form `file://` URI. Returns null when the path can't exist in the mapped
 * environment (e.g. a non-WSL path under a WSL mapping) — callers treat that as "no LSP here".
 */
export function deckPathToUri(deckPath: string, mapping: LspMapping): string | null {
  const posix = toPosixPath(deckPath);
  if (mapping.kind === "wsl") {
    const wsl = parseWslRoot(posix);
    if (!wsl) return null;
    return `file://${encodePathForUri(wsl.guestPath)}`;
  }
  const drive = /^([A-Za-z]):(\/.*)?$/.exec(posix);
  if (drive?.[1]) {
    return `file:///${drive[1].toLowerCase()}%3A${encodePathForUri(drive[2] ?? "/")}`;
  }
  if (posix.startsWith("//")) {
    // Plain UNC share (not WSL): authority-form file URI, file://server/share/...
    return `file:${encodePathForUri(posix)}`;
  }
  return `file://${encodePathForUri(posix)}`;
}

/**
 * Server-form `file://` URI → deck path. Tolerates both `%3A` and raw `:` drive separators and
 * an authority component (some servers emit `file://localhost/...` or UNC-authority URIs).
 * Returns null for non-file URIs (e.g. `untitled:`) — callers skip those.
 */
export function uriToDeckPath(uri: string, mapping: LspMapping): string | null {
  const m = /^file:\/\/([^/]*)(\/.*)?$/i.exec(uri);
  if (!m) return null;
  const authority = m[1] ?? "";
  const path = decodeUriPath(m[2] ?? "/");
  if (authority && authority.toLowerCase() !== "localhost") {
    // UNC-authority URI — reproduce the deck UNC form directly.
    return toPosixPath(`//${authority}${path}`);
  }
  if (mapping.kind === "wsl") {
    return toPosixPath(`//wsl.localhost/${mapping.distro}${path === "/" ? "" : path}`);
  }
  const drive = /^\/([A-Za-z]):(\/.*)?$/.exec(path);
  if (drive?.[1]) {
    // Deck paths carry uppercase drive letters (Electron dialogs / fs walk convention) — keep
    // tab identity stable when a server echoes the vscode-uri lowercase form back.
    return `${drive[1].toUpperCase()}:${drive[2] ?? "/"}`;
  }
  return path;
}
