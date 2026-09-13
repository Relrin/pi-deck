/**
 * TypeScript-AST scans over `packages/ui/src`, shared by `i18n-check.ts` and the i18n tests.
 *
 * Three passes live here, all of them AST rather than regex. That is not fastidiousness: a regex
 * over JSX mistakes `>` in `Date.now() - call.startedAt` and `Promise<void>` for a closing tag, and
 * it cannot see through the subtree aliasing (`const copy = t.chat.modeMenu`) that the object API
 * makes idiomatic. Both mistakes produce findings a reader learns to ignore, which is how a ratchet
 * dies.
 *
 * Kept free of `node:fs` — callers pass file contents in, so the tests can feed synthetic sources.
 */
import ts from "typescript";

export interface SourceFileInput {
  /** Repo-relative, forward-slashed. Used for globs, reporting and baseline keys. */
  path: string;
  text: string;
}

export interface ScanFinding {
  path: string;
  line: number;
  text: string;
  reason: string;
}

/**
 * Whole files whose every string is an identifier rather than copy.
 *
 * Only `.tsx` files belong here — the hardcoded scan never reads `.ts`, so listing
 * `toolCatalog.ts`, `diffThemes.ts`, `languages.ts` or `terminalFonts.ts` (all `.ts`, all genuinely
 * exempt) would be a no-op that reads like protection. Those are covered by review, and by the
 * frozen-table scan where they apply.
 *
 * A file that contains real copy *and* identifiers gets inline `// i18n-exempt:` markers instead —
 * a path glob there would blanket the copy too.
 */
export const EXEMPT_GLOBS: ReadonlyArray<{ glob: string; reason: string }> = [
  {
    glob: "**/components/kbd/PidKbd.tsx",
    reason: "KeyboardEvent.key values and platform glyphs — matched against events, not read",
  },
  {
    glob: "**/components/glyph/kinds.tsx",
    reason: "icon identifiers and SVG path data; the file carries no labels",
  },
  {
    glob: "**/features/models/icons/index.tsx",
    reason: "provider brand names",
  },
];

/** JSX attributes whose string-literal values reach a user or a screen reader. */
const COPY_ATTRIBUTES = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
]);

/** Property names that make a module-level constant an option table rather than config. */
const COPY_PROPERTIES = new Set([
  "blurb",
  "desc",
  "description",
  "hint",
  "label",
  "placeholder",
  "title",
]);

const HAS_LETTERS = /\p{L}{2,}/u;

/**
 * A single token containing path/id punctuation is data, not a sentence: `.pi/mcp.json`,
 * `~/.pi/agent/auth.json`, `npm:pi-mcp-adapter`, `SKILL.md`. Requiring the absence of whitespace
 * keeps real sentences that merely contain a full stop.
 *
 * `-` is deliberately **not** in the set: including it would silence `Word-Alt`, which is a label.
 */
const IDENTIFIER_PUNCTUATION = /[/.:@~\\]/;

function looksLikeIdentifier(text: string): boolean {
  return !/\s/.test(text) && IDENTIFIER_PUNCTUATION.test(text);
}

export function matchesGlob(path: string, glob: string): boolean {
  return new Bun.Glob(glob).match(path);
}

export function isExemptPath(path: string): boolean {
  return EXEMPT_GLOBS.some((entry) => matchesGlob(path, entry.glob));
}

/**
 * Both comment styles: `//` in ordinary code, and `{/* … *\/}` in JSX children, where a `//`
 * comment would render as text. A trailing `*\/` (and the JSX `}`) is trimmed off the reason.
 */
const EXEMPT_LINE_RE = /(?:\/\/|\/\*)\s*i18n-exempt:\s*(\S[^\n]*?)(?:\s*\*\/\s*\}?)?$/;
const EXEMPT_FILE_RE = /(?:\/\/|\/\*)\s*i18n-exempt-file:\s*(\S[^\n]*?)(?:\s*\*\/\s*\}?)?$/;
const EXEMPT_BARE_RE = /(?:\/\/|\/\*)\s*i18n-exempt(-file)?\s*:?\s*(?:\*\/\s*\}?)?$/;

interface Exemptions {
  /** 1-based lines a finding may sit on: the marker's own line and the line after it. */
  lines: Set<number>;
  fileLevel: boolean;
  /** Markers with no reason, or a reason under three characters. Reported, never honoured. */
  malformed: Array<{ line: number; text: string }>;
}

/**
 * `// i18n-exempt: <reason>` is honoured trailing on the flagged line and leading on the line
 * above; `// i18n-exempt-file: <reason>` in the first 20 lines covers the whole file.
 *
 * The reason is mandatory and must be at least three characters. A bare marker that silenced a
 * finding would be a blanket suppression by another name, so it is collected as malformed and
 * reported rather than honoured.
 */
export function collectExemptions(text: string): Exemptions {
  const lines = text.split(/\r?\n/);
  const out: Exemptions = { lines: new Set(), fileLevel: false, malformed: [] };

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const fileMatch = EXEMPT_FILE_RE.exec(line);
    if (fileMatch && (fileMatch[1]?.trim().length ?? 0) >= 3) {
      if (lineNumber <= 20) out.fileLevel = true;
      continue;
    }
    const match = EXEMPT_LINE_RE.exec(line);
    if (match && (match[1]?.trim().length ?? 0) >= 3) {
      out.lines.add(lineNumber);
      out.lines.add(lineNumber + 1);
      continue;
    }
    if (EXEMPT_BARE_RE.test(line) || (match && (match[1]?.trim().length ?? 0) < 3)) {
      out.malformed.push({ line: lineNumber, text: line.trim() });
    }
  }

  return out;
}

function parse(file: SourceFileInput): ts.SourceFile {
  return ts.createSourceFile(
    file.path,
    file.text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    file.path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function literalText(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isJsxExpression(node)) return literalText(node.expression);
  return undefined;
}

/** JSX text nodes and string-literal copy attributes that never reached the catalog. */
export function scanHardcodedStrings(file: SourceFileInput): ScanFinding[] {
  if (isExemptPath(file.path)) return [];
  const exemptions = collectExemptions(file.text);
  if (exemptions.fileLevel) return [];

  const source = parse(file);
  const findings: ScanFinding[] = [];

  const record = (node: ts.Node, text: string, reason: string) => {
    const trimmed = text.trim();
    if (!HAS_LETTERS.test(trimmed) || looksLikeIdentifier(trimmed)) return;
    const line = lineOf(source, node);
    if (exemptions.lines.has(line)) return;
    findings.push({ path: file.path, line, text: trimmed, reason });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (!node.containsOnlyTriviaWhiteSpaces) record(node, node.text, "JSX text");
    } else if (ts.isJsxAttribute(node)) {
      const name = ts.isIdentifier(node.name) ? node.name.text : node.name.namespace.text;
      if (COPY_ATTRIBUTES.has(name)) {
        const value = literalText(node.initializer);
        if (value !== undefined) record(node, value, `${name}=`);
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return findings;
}

/**
 * Module-level constants holding copy — the `.tsx` half of the staleness bug that
 * `noRestrictedImports` cannot see. A table resolved at import time freezes whatever locale
 * happened to be loaded then and never updates, which no rendering test catches because the first
 * render is correct. Option tables must be functions taking `t: TranslationFunctions`.
 */
export function scanFrozenTables(file: SourceFileInput): ScanFinding[] {
  if (isExemptPath(file.path)) return [];
  const exemptions = collectExemptions(file.text);
  if (exemptions.fileLevel) return [];

  const source = parse(file);
  const findings: ScanFinding[] = [];

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const initializer = declaration.initializer;
      if (!initializer) continue;
      if (!ts.isArrayLiteralExpression(initializer) && !ts.isObjectLiteralExpression(initializer)) {
        continue;
      }
      // An exemption on the declaration line covers the whole table. A table of configuration —
      // language-server presets, theme ids — is one decision, not one decision per row, and
      // requiring a marker per row would bury the reason in noise.
      if (exemptions.lines.has(lineOf(source, statement))) continue;

      const visit = (node: ts.Node): void => {
        if (ts.isPropertyAssignment(node)) {
          const name = ts.isIdentifier(node.name)
            ? node.name.text
            : ts.isStringLiteral(node.name)
              ? node.name.text
              : undefined;
          const value = literalText(node.initializer);
          if (name && COPY_PROPERTIES.has(name) && value !== undefined && HAS_LETTERS.test(value)) {
            const line = lineOf(source, node);
            if (!exemptions.lines.has(line)) {
              const constName = ts.isIdentifier(declaration.name) ? declaration.name.text : "?";
              findings.push({
                path: file.path,
                line,
                text: `${constName}.${name} = ${JSON.stringify(value)}`,
                reason: "module-level option table freezes the launch locale",
              });
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(initializer);
    }
  }

  return findings;
}

export interface UsageResult {
  /** Fully resolved catalog paths, e.g. `git.notify.commit.title`. */
  used: Set<string>;
  /** Static prefixes reached through a computed key; everything below them counts as used. */
  dynamicPrefixes: Set<string>;
  /** Files that reach for the runtime but yield no catalog path — an API drift signal. Fatal. */
  unresolved: ScanFinding[];
}

interface Chain {
  root: string;
  segments: string[];
  dynamic: boolean;
}

/** Flatten `LL.a.b[x].c` into its root identifier plus the segments up to any computed access. */
function flattenChain(node: ts.Node): Chain | undefined {
  const segments: string[] = [];
  let dynamic = false;
  let current: ts.Node = node;

  for (;;) {
    if (ts.isCallExpression(current)) {
      current = current.expression;
    } else if (ts.isPropertyAccessExpression(current)) {
      segments.unshift(current.name.text);
      current = current.expression;
    } else if (ts.isElementAccessExpression(current)) {
      const argument = current.argumentExpression;
      if (ts.isStringLiteral(argument)) segments.unshift(argument.text);
      else {
        // A computed key. Everything below the static prefix is reachable, so truncate here and
        // mark the prefix dynamic rather than inventing an allowlist entry for it.
        segments.length = 0;
        dynamic = true;
        return collectStaticPrefix(current.expression, dynamic);
      }
      current = current.expression;
    } else if (ts.isNonNullExpression(current) || ts.isParenthesizedExpression(current)) {
      current = current.expression;
    } else if (ts.isIdentifier(current)) {
      return { root: current.text, segments, dynamic };
    } else {
      return undefined;
    }
  }
}

function collectStaticPrefix(node: ts.Node, dynamic: boolean): Chain | undefined {
  const chain = flattenChain(node);
  if (!chain) return undefined;
  return { ...chain, dynamic: dynamic || chain.dynamic };
}

const ROOT_FACTORIES = new Set(["ll", "llFor"]);
const FALLBACK_ROOT_NAMES = new Set(["LL", "ll", "t"]);

/** Modules whose import means the file reads translations rather than merely locale metadata. */
const RUNTIME_SPECIFIER = /(^|\/)i18n(\/(t|i18n-react|index))?(\.js|\.ts|\.tsx)?$/;

/**
 * Whether a file imports the translation runtime *and* names one of its accessors.
 *
 * Deliberately keyed on the identifier `LL` and on `ll()`/`llFor()` calls rather than on the hook:
 * plenty of components import `useI18nContext` only to read `locale` for the format helpers and
 * never touch translations, and those must not trip the drift guard. Conversely, keying on `LL`
 * still fires if the hook itself is renamed, which is the drift worth catching.
 */
function usesRuntime(source: ts.SourceFile): boolean {
  let imports = false;
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier)) continue;
    if (RUNTIME_SPECIFIER.test(specifier.text) || specifier.text === "@pi-deck/ui/i18n") {
      imports = true;
      break;
    }
  }
  if (!imports) return false;

  let names = false;
  const visit = (node: ts.Node): void => {
    if (names) return;
    if (ts.isIdentifier(node) && node.text === "LL") names = true;
    else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ROOT_FACTORIES.has(node.expression.text)
    ) {
      names = true;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return names;
}

/**
 * Which catalog keys the source actually reads.
 *
 * Two passes. The first seeds roots — `const { LL } = useI18nContext()`, a parameter annotated
 * `TranslationFunctions`, a `ll()`/`llFor()` initializer — and the second resolves property chains
 * against them, re-running while new aliases appear so that `const copy = t.chat.modeMenu` (and an
 * alias of an alias) resolves to its full prefix.
 *
 * The fallback root rule — an identifier literally named `LL`/`t`/`ll` whose first segment is a
 * known namespace — is what catches contextually typed callbacks such as `host-errors.ts`'s
 * `(t) => t.common.error.host.notFound()`. The namespace condition is also what rejects the false
 * friend in `features/files/pierreTreeAdapters.ts`, a CSS-token helper also named `t`: it is only
 * ever *called* as `t("--bg-1")` and never accessed as `t.<namespace>`.
 */
export function collectUsedKeys(files: SourceFileInput[], namespaces: string[]): UsageResult {
  const used = new Set<string>();
  const dynamicPrefixes = new Set<string>();
  const unresolved: ScanFinding[] = [];
  const namespaceSet = new Set(namespaces);

  for (const file of files) {
    const source = parse(file);
    // `ll()` / `llFor(locale)` are roots in their own right, not only through a variable: the chain
    // `llFor(locale).format.justNow()` flattens to the callee identifier.
    const roots = new Map<string, string>([...ROOT_FACTORIES].map((name) => [name, ""]));
    const chains: Array<{ node: ts.Node; chain: Chain }> = [];
    const aliases: Array<{ name: string; chain: Chain }> = [];

    const seed = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const init = node.initializer;
        if (ts.isCallExpression(init) && ts.isIdentifier(init.expression)) {
          const callee = init.expression.text;
          if (callee === "useI18nContext" && ts.isObjectBindingPattern(node.name)) {
            for (const element of node.name.elements) {
              const key = element.propertyName ?? element.name;
              const keyName = ts.isIdentifier(key) ? key.text : undefined;
              if (keyName === "LL" && ts.isIdentifier(element.name))
                roots.set(element.name.text, "");
            }
          } else if (ROOT_FACTORIES.has(callee) && ts.isIdentifier(node.name)) {
            roots.set(node.name.text, "");
          }
        }
      }
      if (ts.isParameter(node) && node.type && ts.isIdentifier(node.name)) {
        const typeName = ts.isTypeReferenceNode(node.type) ? node.type.typeName : undefined;
        if (typeName && ts.isIdentifier(typeName) && typeName.text === "TranslationFunctions") {
          roots.set(node.name.text, "");
        }
      }
      ts.forEachChild(node, seed);
    };
    ts.forEachChild(source, seed);

    const collect = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const parent = node.parent;
        const isTopOfChain =
          !parent ||
          (!ts.isPropertyAccessExpression(parent) && !ts.isElementAccessExpression(parent));
        if (isTopOfChain) {
          const chain = flattenChain(node);
          if (chain) {
            chains.push({ node, chain });
            if (
              ts.isVariableDeclaration(node.parent) &&
              ts.isIdentifier(node.parent.name) &&
              !chain.dynamic
            ) {
              aliases.push({ name: node.parent.name.text, chain });
            }
          }
        }
      }
      ts.forEachChild(node, collect);
    };
    ts.forEachChild(source, collect);

    // Fallback roots, then the alias fixpoint. Both loops terminate: each iteration that does not
    // grow `roots` exits.
    for (const { chain } of chains) {
      if (roots.has(chain.root)) continue;
      if (!FALLBACK_ROOT_NAMES.has(chain.root)) continue;
      if (chain.segments[0] && namespaceSet.has(chain.segments[0])) roots.set(chain.root, "");
    }

    for (;;) {
      let grew = false;
      for (const alias of aliases) {
        if (roots.has(alias.name)) continue;
        const base = roots.get(alias.chain.root);
        if (base === undefined) continue;
        const prefix = [base, ...alias.chain.segments].filter(Boolean).join(".");
        if (!prefix || !namespaceSet.has(prefix.split(".")[0] ?? "")) continue;
        roots.set(alias.name, prefix);
        grew = true;
      }
      if (!grew) break;
    }

    let emitted = 0;
    for (const { chain } of chains) {
      const base = roots.get(chain.root);
      if (base === undefined) continue;
      const path = [base, ...chain.segments].filter(Boolean).join(".");
      if (!path) continue;
      if (!namespaceSet.has(path.split(".")[0] ?? "")) continue;
      if (chain.dynamic) dynamicPrefixes.add(path);
      else used.add(path);
      emitted += 1;
    }

    // The guard that makes the unused-key report trustworthy. A file that names `LL` yet binds no
    // root means the access pattern moved out from under these passes — at which point every key
    // they cover would look unused and a tired reader would delete real copy. Fail loudly instead.
    // Forwarding a bound `LL` into a builder (`introTemplates(LL)`) binds a root and is fine.
    if (emitted === 0 && roots.size === ROOT_FACTORIES.size && usesRuntime(source)) {
      unresolved.push({
        path: file.path,
        line: 1,
        text: file.path,
        reason: "imports the i18n runtime but no catalog path resolved — the AST passes have a gap",
      });
    }
  }

  return { used, dynamicPrefixes, unresolved };
}

/** Catalog keys with no reachable call site. */
export function unusedKeys(allKeys: Iterable<string>, usage: UsageResult): string[] {
  const out: string[] = [];
  for (const key of allKeys) {
    if (usage.used.has(key)) continue;
    // A parent path counts: `LL.settings.nav` aliased and then indexed reaches every child.
    let covered = false;
    for (const prefix of usage.dynamicPrefixes) {
      if (key === prefix || key.startsWith(`${prefix}.`)) {
        covered = true;
        break;
      }
    }
    if (!covered) {
      for (const path of usage.used) {
        if (key.startsWith(`${path}.`)) {
          covered = true;
          break;
        }
      }
    }
    if (!covered) out.push(key);
  }
  return out;
}
