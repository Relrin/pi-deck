/**
 * `iconForFile(path)` → an iconify icon name from the `material-icon-theme` set.
 *
 * Mapping is in two passes:
 *   1. exact filename / glob match (e.g. `package.json`, `Dockerfile`, `.gitignore`,
 *      `tsconfig.*.json`). These take precedence so common config files get their bespoke
 *      icon even when the extension would otherwise win.
 *   2. extension match (e.g. `.ts → typescript`, `.rs → rust`).
 *
 * Every icon referenced here was confirmed against the published `@iconify-json/material-icon-theme`
 * dataset — if a future icon doesn't exist, iconify renders an empty box rather than throwing,
 * but we still prefer to keep this list correct. `DEFAULT_FILE_ICON` is the safe fallback for
 * anything we don't recognise.
 *
 * Per AGENTS.md, **icons are imported from `packages/ui/src/components/icons/` only**. This
 * module is the swap point for file-type recognition; callers pass a path and get back an
 * Iconify name (`"material-icon-theme:typescript"`) to feed straight into `<Icon icon={…} />`.
 */

export const DEFAULT_FILE_ICON = "material-icon-theme:document";

/** Exact-filename map; checked before extensions. Keys are lowercased. */
const EXACT_FILENAMES: Record<string, string> = {
  // node / bun / npm
  "package.json": "nodejs",
  "package-lock.json": "nodejs",
  "yarn.lock": "yarn",
  "bun.lock": "bun",
  "bun.lockb": "bun",
  "npm-shrinkwrap.json": "npm",
  ".npmrc": "npm",
  ".nvmrc": "nodejs",

  // tooling configs
  "tsconfig.json": "tsconfig",
  "tsconfig.base.json": "tsconfig",
  "biome.json": "biome",
  "biome.jsonc": "biome",
  ".eslintrc": "eslint",
  ".eslintrc.json": "eslint",
  ".eslintrc.js": "eslint",
  ".eslintrc.cjs": "eslint",
  "eslint.config.js": "eslint",
  "eslint.config.mjs": "eslint",
  "eslint.config.ts": "eslint",
  ".prettierrc": "prettier",
  ".prettierrc.json": "prettier",
  ".prettierrc.js": "prettier",
  "prettier.config.js": "prettier",

  // build / framework configs
  "vite.config.ts": "vite",
  "vite.config.js": "vite",
  "webpack.config.js": "webpack",
  "webpack.config.ts": "webpack",
  "tailwind.config.js": "tailwindcss",
  "tailwind.config.ts": "tailwindcss",
  "tailwind.config.cjs": "tailwindcss",
  "astro.config.mjs": "astro-config",
  "astro.config.ts": "astro-config",
  "next.config.js": "next",
  "next.config.mjs": "next",
  "next.config.ts": "next",
  "nuxt.config.ts": "nuxt",
  "svelte.config.js": "svelte",

  // git
  ".gitignore": "git",
  ".gitattributes": "git",
  ".gitmodules": "git",
  ".gitkeep": "git",

  // docker / k8s
  dockerfile: "docker",
  "docker-compose.yml": "docker",
  "docker-compose.yaml": "docker",
  ".dockerignore": "docker",

  // rust / cargo
  "cargo.toml": "rust",
  "cargo.lock": "rust",

  // python
  "pyproject.toml": "python",
  "requirements.txt": "python",
  pipfile: "python",
  "pipfile.lock": "python",
  "poetry.lock": "python",
  "setup.py": "python",

  // ruby
  gemfile: "ruby",
  "gemfile.lock": "ruby",

  // go
  "go.mod": "go",
  "go.sum": "go",

  // misc
  makefile: "makefile",
  "readme.md": "readme",
  "readme.markdown": "readme",
  "readme.txt": "readme",
  license: "certificate",
  "license.md": "certificate",
  "license.txt": "certificate",
  "changelog.md": "changelog",
  "vercel.json": "vercel",
  "netlify.toml": "netlify",
};

/** Extension → icon name. Keys are lowercased without the leading dot. */
const EXTENSIONS: Record<string, string> = {
  // typescript / javascript
  ts: "typescript",
  cts: "typescript",
  mts: "typescript",
  tsx: "react-ts",
  js: "javascript",
  cjs: "javascript",
  mjs: "javascript",
  jsx: "react",

  // data / config
  json: "json",
  jsonc: "json",
  json5: "json",
  yaml: "yaml",
  yml: "yaml",
  xml: "xml",
  toml: "toml",
  ini: "settings",
  env: "tune",
  graphql: "graphql",
  gql: "graphql",
  sql: "database",

  // languages
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  php: "php",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  lua: "lua",
  zig: "zig",
  dart: "dart",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  elm: "elm",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  ml: "ocaml",
  scala: "scala",

  // markup / styling
  md: "markdown",
  mdx: "markdown",
  markdown: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  scss: "sass",
  sass: "sass",
  less: "less",

  // shell
  sh: "console",
  bash: "console",
  zsh: "console",
  fish: "console",
  ps1: "powershell",

  // images
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  ico: "image",
  svg: "svg",

  // archives
  zip: "zip",
  tar: "zip",
  gz: "zip",
  tgz: "zip",
  bz2: "zip",
  "7z": "zip",
  rar: "zip",

  // docs
  pdf: "pdf",
  txt: "document",
  log: "log",
  lock: "lock",
};

/**
 * Returns an iconify icon name (`"material-icon-theme:typescript"`) for the given file path.
 * Falls back to a generic document icon for unrecognised paths.
 */
export function iconForFile(path: string): string {
  const name = lastSegment(path).toLowerCase();

  // Exact filename wins over extension (e.g. `package.json` → nodejs, not json).
  const exact = EXACT_FILENAMES[name];
  if (exact) return `material-icon-theme:${exact}`;

  // Dotfile heuristic: `.env.local`, `.env.production`, etc. all share the env icon.
  if (name.startsWith(".env")) return "material-icon-theme:tune";

  // tsconfig variants (`tsconfig.test.json`, `tsconfig.build.json` …).
  if (name.startsWith("tsconfig.") && name.endsWith(".json")) {
    return "material-icon-theme:tsconfig";
  }

  // Extension match. Strip a leading dot, then split on `.` and take the last fragment.
  const ext = extensionOf(name);
  if (ext) {
    const mapped = EXTENSIONS[ext];
    if (mapped) return `material-icon-theme:${mapped}`;
  }

  return DEFAULT_FILE_ICON;
}

function lastSegment(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

function extensionOf(filename: string): string | undefined {
  // A leading dot is part of a dotfile (e.g. `.gitignore`), not an extension.
  const trimmed = filename.startsWith(".") ? filename.slice(1) : filename;
  const dot = trimmed.lastIndexOf(".");
  if (dot < 0) return undefined;
  return trimmed.slice(dot + 1);
}
