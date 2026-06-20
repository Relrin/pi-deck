/**
 * Best-effort classification of a `bash` tool call as read-only — i.e. it inspects the
 * workspace/environment but doesn't modify anything. Plan mode uses this so the agent can
 * actually explore the repo (ls, cat, grep, find, sed, awk, sort, git log, ...) instead of
 * having every shell call blocked, which made "planning" feel broken.
 *
 * Design: conservative by construction. return `true` when we can positively prove a
 * command is read-only — every segment's leading command is on a curated allowlist, there's
 * no write redirection, and the few dual-use tools (sed/find/git) pass a flag/subcommand
 * gate. Anything we can't prove read-only returns `false`, so the caller keeps the safe
 * behavior (block in plan mode).
 */

/**
 * Commands whose default behavior only reads. Dual-use members (`sed`, `find`, `git`) are
 * further gated below; anything not listed here (rm, mv, cp, mkdir, touch, tee, xargs, dd,
 * npm/pip/make, ...) makes the command non-read-only.
 */
const READ_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  // navigation / listing
  "ls",
  "pwd",
  "cd",
  "tree",
  "find",
  "fd",
  // reading files
  "cat",
  "tac",
  "bat",
  "head",
  "tail",
  "nl",
  // file metadata / paths
  "stat",
  "file",
  "wc",
  "du",
  "df",
  "readlink",
  "realpath",
  "basename",
  "dirname",
  // text search
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "ag",
  "ack",
  // text processing (read-only by default — output goes to stdout)
  "sort",
  "uniq",
  "cut",
  "tr",
  "column",
  "comm",
  "join",
  "paste",
  "rev",
  "fold",
  "expand",
  "unexpand",
  "fmt",
  "awk",
  "gawk",
  "sed",
  "diff",
  "cmp",
  // command lookup
  "which",
  "type",
  "whereis",
  "command",
  "hash",
  // environment / system info
  "date",
  "env",
  "printenv",
  "whoami",
  "id",
  "groups",
  "uname",
  "hostname",
  "arch",
  "uptime",
  "echo",
  "printf",
  // hashing / encoding (pure stdout transforms)
  "jq",
  "yq",
  "xxd",
  "od",
  "strings",
  "base64",
  "cksum",
  "md5sum",
  "sha1sum",
  "sha256sum",
  "sha512sum",
  // version control (read-only subcommands only — see GIT_READONLY_SUBCOMMANDS)
  "git",
  // shell builtins / no-ops / conditionals
  "test",
  "true",
  "false",
  "seq",
  "[",
  "[[",
]);

/** `find` predicates/actions that execute or write. Their presence makes a `find` non-read-only. */
const FIND_MUTATING_TOKENS: ReadonlySet<string> = new Set([
  "-delete",
  "-exec",
  "-execdir",
  "-ok",
  "-okdir",
  "-fprint",
  "-fprint0",
  "-fprintf",
  "-fls",
]);

/**
 * `git` subcommands that are read-only in every form (modulo output redirection, which is
 * checked separately). Mutation-capable subcommands (branch/tag/remote/config/stash/checkout/
 * commit/fetch/…) are intentionally absent, so they stay blocked in plan mode.
 */
const GIT_READONLY_SUBCOMMANDS: ReadonlySet<string> = new Set([
  "status",
  "log",
  "show",
  "diff",
  "rev-parse",
  "rev-list",
  "ls-files",
  "ls-tree",
  "ls-remote",
  "cat-file",
  "describe",
  "blame",
  "shortlog",
  "show-ref",
  "for-each-ref",
  "grep",
  "merge-base",
  "name-rev",
  "count-objects",
  "whatchanged",
  "version",
  "help",
]);

/** Extract the `command` string from a `bash` tool input, if present. */
export function isReadOnlyBashCommand(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const command = (input as { command?: unknown }).command;
  if (typeof command !== "string") return false;
  return isReadOnlyShellCommand(command);
}

/** Whether a raw shell command line only reads (see module doc for the conservative contract). */
export function isReadOnlyShellCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (hasUnsafeRedirect(trimmed)) return false;

  let sawCommand = false;
  for (const segment of splitSegments(trimmed)) {
    if (segment.trim() === "") continue; // empty span from a trailing/leading operator
    sawCommand = true;
    if (!isReadOnlySegment(segment)) return false;
  }
  return sawCommand;
}

function isReadOnlySegment(segment: string): boolean {
  const tokens = tokenize(segment);
  const parsed = commandTokens(tokens);
  // Pure `VAR=value` assignment with no command, or an empty group — a no-op, so read-only.
  if (!parsed) return true;
  const { cmd, args } = parsed;
  if (!READ_ONLY_COMMANDS.has(cmd)) return false;
  if (cmd === "sed") return sedIsReadOnly(args);
  if (cmd === "find" || cmd === "fd") return findIsReadOnly(args);
  if (cmd === "git") return gitIsReadOnly(args);
  return true;
}

function sedIsReadOnly(args: readonly string[]): boolean {
  for (const t of args) {
    if (t === "--in-place" || t.startsWith("--in-place=")) return false;
    // `-i`, `-i.bak`, or a combined short cluster containing `i` (e.g. `-ni`) — all in-place.
    if (t.startsWith("-") && !t.startsWith("--") && t.includes("i")) return false;
  }
  return true;
}

function findIsReadOnly(args: readonly string[]): boolean {
  return !args.some((t) => FIND_MUTATING_TOKENS.has(t));
}

function gitIsReadOnly(args: readonly string[]): boolean {
  let i = 0;
  // Skip global options that precede the subcommand. `-C <path>` and `-c <name=value>` consume
  // a following value; `--git-dir`/`--work-tree`/`--namespace` likewise (their `=` forms and any
  // other `--flag`/`-p` are single tokens).
  while (i < args.length) {
    const t = args[i];
    if (t === undefined) break;
    if (
      t === "-C" ||
      t === "-c" ||
      t === "--git-dir" ||
      t === "--work-tree" ||
      t === "--namespace"
    ) {
      i += 2;
      continue;
    }
    if (t.startsWith("-")) {
      i += 1;
      continue;
    }
    break;
  }
  const sub = args[i];
  if (sub === undefined) return true; // bare `git` just prints usage
  return GIT_READONLY_SUBCOMMANDS.has(sub);
}

/**
 * Find the leading command of a segment, skipping leading `VAR=value` assignments, `!`
 * negation, and `(`/`{` grouping. Returns the command basename (so `/bin/ls` → `ls`) plus the
 * remaining tokens, or `undefined` when there's no command (e.g. assignment-only).
 */
function commandTokens(tokens: readonly string[]): { cmd: string; args: string[] } | undefined {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === undefined) break;
    if (t === "!" || t === "(" || t === "{") {
      i += 1;
      continue;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
      i += 1;
      continue;
    }
    break;
  }
  let first = tokens[i];
  if (first === undefined) return undefined;
  // Strip grouping chars glued to the command, e.g. "(ls".
  first = first.replace(/^[({]+/, "");
  if (first === "") {
    i += 1;
    first = tokens[i];
    if (first === undefined) return undefined;
  }
  const cmd = first.split(/[/\\]/).pop() ?? first;
  if (cmd === "") return undefined;
  return { cmd, args: tokens.slice(i + 1) };
}

/**
 * Quote-aware split into top-level command segments on `;`, newline, `|`/`||`, and `&&`/`&`.
 * A lone `&` adjacent to `>` (e.g. `2>&1`, `&>`) is treated as part of a redirection, not a
 * separator, so fd-duplication survives intact.
 */
function splitSegments(command: string): string[] {
  const segments: string[] = [];
  let cur = "";
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    const next = command[i + 1];
    if (inSingle) {
      cur += c;
      if (c === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      cur += c;
      if (c === '"') inDouble = false;
      else if (c === "\\" && next !== undefined) {
        cur += next;
        i += 1;
      }
      continue;
    }
    if (c === "'") {
      inSingle = true;
      cur += c;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      cur += c;
      continue;
    }
    if (c === "\\" && next !== undefined) {
      cur += c + next;
      i += 1;
      continue;
    }
    if (c === "\n" || c === ";") {
      segments.push(cur);
      cur = "";
      continue;
    }
    if (c === "|") {
      if (next === "|") i += 1;
      segments.push(cur);
      cur = "";
      continue;
    }
    if (c === "&") {
      if (next === "&") {
        i += 1;
        segments.push(cur);
        cur = "";
        continue;
      }
      // Lone `&` that's part of a redirection (`>&`, `&>`) stays with the segment.
      if (command[i - 1] === ">" || next === ">") {
        cur += c;
        continue;
      }
      segments.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  segments.push(cur);
  return segments;
}

/**
 * Detect an output redirection to a real file (`> f`, `>> f`, `2> f`, `&> f`). fd-duplication
 * (`2>&1`, `>&2`) and redirection to `/dev/null` are treated as safe. Input redirection (`<`)
 * is reading, so it's ignored. Quote-aware so `>` inside a quoted arg (e.g. an awk comparison
 * `awk '$1 > 5'`) is not mistaken for a redirection.
 */
function hasUnsafeRedirect(command: string): boolean {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (inSingle) {
      if (c === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (c === '"') inDouble = false;
      else if (c === "\\" && command[i + 1] !== undefined) i += 1;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      continue;
    }
    if (c === "\\") {
      i += 1;
      continue;
    }
    if (c === ">") {
      let j = i + 1;
      if (command[j] === ">") j += 1; // append form `>>`
      while (command[j] === " " || command[j] === "\t") j += 1;
      if (command[j] === "&") continue; // fd duplication / close — no file written
      let k = j;
      while (k < command.length && !/[\s;|&<>()]/.test(command[k] as string)) k += 1;
      const target = command.slice(j, k);
      if (target === "/dev/null") continue;
      return true;
    }
  }
  return false;
}

/** Quote-aware whitespace tokenizer; strips surrounding quotes and processes simple escapes. */
function tokenize(segment: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let started = false;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (c === undefined) continue;
    if (inSingle) {
      if (c === "'") inSingle = false;
      else cur += c;
      started = true;
      continue;
    }
    if (inDouble) {
      if (c === '"') inDouble = false;
      else if (c === "\\" && /["\\$`]/.test(segment[i + 1] ?? "")) {
        cur += segment[i + 1];
        i += 1;
      } else cur += c;
      started = true;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      started = true;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      started = true;
      continue;
    }
    if (c === "\\" && segment[i + 1] !== undefined) {
      cur += segment[i + 1];
      i += 1;
      started = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (started) {
        tokens.push(cur);
        cur = "";
        started = false;
      }
      continue;
    }
    cur += c;
    started = true;
  }
  if (started) tokens.push(cur);
  return tokens;
}
