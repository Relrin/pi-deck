/**
 * Regenerate the subsetted Devicon font used by the terminal shell-type icons.
 *
 * Run from the repo root: `bun packages/ui/scripts/build-devicon-subset.ts`
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import subsetFont from "subset-font";

/** Devicon icon names we render (each via its `-plain` variant). */
const NAMES = [
  "powershell",
  "windows11",
  "git",
  "bash",
  "zsh",
  "ubuntu",
  "debian",
  "kalilinux",
  "archlinux",
  "fedora",
  "opensuse",
  "linux",
];

const cssPath = require.resolve("devicon/devicon.min.css");
const ttfPath = path.join(path.dirname(cssPath), "fonts", "devicon.ttf");
const css = readFileSync(cssPath, "utf8");

const glyphs: Array<{ name: string; char: string; cp: string; color?: string }> = [];
for (const name of NAMES) {
  const content = new RegExp(`\\.devicon-${name}-plain:before\\{content:"(.*?)"\\}`).exec(css);
  if (!content?.[1]) throw new Error(`No glyph content for devicon-${name}-plain`);
  const char = content[1];
  const cp = char.codePointAt(0)?.toString(16) ?? "";
  const color = new RegExp(
    `\\.devicon-${name}-plain\\.colored[^{]*\\{color:(#[0-9a-fA-F]+)\\}`,
  ).exec(css)?.[1];
  glyphs.push({ name, char, cp, color });
}

const text = glyphs.map((g) => g.char).join("");
const ttf = readFileSync(ttfPath);
const woff2 = await subsetFont(ttf, text, { targetFormat: "woff2" });

const outDir = path.join(import.meta.dir, "..", "src", "theme", "fonts");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "devicon-subset.woff2"), woff2);

console.log(`Wrote devicon-subset.woff2 (${(woff2.length / 1024).toFixed(1)} KB)\n`);
console.log("Glyph rules (paste into src/theme/devicon.css):\n");
for (const g of glyphs) {
  console.log(`.devicon-${g.name}-plain::before { content: "\\${g.cp}"; }`);
}
console.log("");
for (const g of glyphs) {
  if (g.color) console.log(`.devicon-${g.name}-plain.colored { color: ${g.color}; }`);
}
