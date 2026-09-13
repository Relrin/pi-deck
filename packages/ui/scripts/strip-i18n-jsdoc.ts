import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TYPES_FILE = path.join(import.meta.dir, "..", "src", "i18n", "i18n-types.ts");

const source = readFileSync(TYPES_FILE, "utf8");

/**
 * Matches a whole indented JSDoc block plus the newline that follows it, so removing one does not
 * leave a blank line behind. Anchored to the line start and non-greedy, so it can never swallow
 * code between two blocks.
 */
const JSDOC_BLOCK = /^[ \t]*\/\*\*[\s\S]*?\*\/\r?\n/gm;

const stripped = source.replace(JSDOC_BLOCK, "");

if (stripped === source) {
  console.log("i18n-types.ts: no generated JSDoc to strip");
  process.exit(0);
}

// Guard against the regex ever over-matching: the file is types only, so every line that survives
// must still parse as part of a type declaration. A crude but effective check is that the exported
// surface is intact — if a greedy match had eaten code, these would be gone.
const REQUIRED = [
  "export type Locales",
  "export type Translation",
  "export type TranslationFunctions",
  "export type Formatters",
];
const missing = REQUIRED.filter((needle) => !stripped.includes(needle));
if (missing.length > 0) {
  console.error(`i18n-types.ts: refusing to write — lost ${missing.join(", ")}`);
  process.exit(1);
}

writeFileSync(TYPES_FILE, stripped, "utf8");

const before = source.split("\n").length;
const after = stripped.split("\n").length;
console.log(`i18n-types.ts: stripped generated JSDoc (${before} → ${after} lines)`);
