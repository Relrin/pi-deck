/** Line-ending vocabulary shared between the editor store and the status bar. Mirrors the
 * host's `fs.readFile` / `fs.writeFile` `eol` field (see `packages/core/src/fs/ops.ts`). */
export type Eol = "lf" | "crlf";

/** Status-bar label for an EOL kind (matches VS Code's wording). */
export function eolLabel(eol: Eol): string {
  return eol === "crlf" ? "CRLF" : "LF";
}
