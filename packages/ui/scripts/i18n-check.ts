/**
 * Catalog and call-site checks for the localization subsystem.
 *
 * Run from the repo root: `bun packages/ui/scripts/i18n-check.ts`
 *
 * Wired as `bun run i18n:check`, which `bun run check` and `.husky/pre-commit` both call, so every
 * rule here gates CI and local commits alike.
 *
 * Severity is deliberately split. Fatal rules are the ones whose breakage is invisible until a user
 * hits it — an orphan key, a `{param}` the base does not declare, a Russian plural written with
 * four slots instead of six. Missing translations are only a *warning*, because `deepMerge` falls
 * back per key: a 40%-translated locale renders English for the rest and is a perfectly shippable
 * commit. Gating on completeness would make incremental translation impossible, which is the one
 * thing the whole design is built to allow.
 *
 * Flags:
 *   --strict            promote every warning to fatal (for the day a locale is declared complete)
 *   --fast              skip the TypeScript-AST passes (catalog rules only)
 *   --list <check>      print the full list for one check instead of the first ten
 *   --update-baseline   rewrite i18n-baseline.json
 *   --allow-increase    permit --update-baseline to raise a count (needs a reason in the diff)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Glob } from "bun";
import {
  type CatalogNode,
  checkPlurals,
  compareCatalogs,
  compareParams,
  type Finding,
  leafPaths,
  requiredSlotCount,
} from "./i18n-audit.ts";
import {
  collectExemptions,
  collectUsedKeys,
  EXEMPT_GLOBS,
  type ScanFinding,
  type SourceFileInput,
  scanFrozenTables,
  scanHardcodedStrings,
  unusedKeys,
} from "./i18n-scan.ts";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");
const UI_SRC = "packages/ui/src";
const CATALOG_DIR = path.join(REPO_ROOT, UI_SRC, "i18n");
const BASELINE_FILE = path.join(import.meta.dir, "i18n-baseline.json");
const INDEX_HTML = path.join(REPO_ROOT, "packages", "desktop", "index.html");

const BASE_LOCALE = "en";

const args = new Set(process.argv.slice(2));
const listArg = process.argv[process.argv.indexOf("--list") + 1];
const STRICT = args.has("--strict");
const FAST = args.has("--fast");
const UPDATE_BASELINE = args.has("--update-baseline");
const ALLOW_INCREASE = args.has("--allow-increase");
const LIST = args.has("--list") ? listArg : undefined;

interface Baseline {
  note: string;
  hardcoded: Record<string, number>;
  frozenTables: Record<string, number>;
}

const problems: Array<{ fatal: boolean; check: string; message: string; details: string[] }> = [];
const rows: Array<{ label: string; value: string; status: "OK" | "WARN" | "FAIL" }> = [];

function report(fatal: boolean, check: string, message: string, details: string[] = []): void {
  problems.push({ fatal: fatal || STRICT, check, message, details });
}

function row(label: string, value: string, status: "OK" | "WARN" | "FAIL"): void {
  rows.push({ label, value, status });
}

function detailsOf(check: string, lines: string[]): string[] {
  return LIST === check ? lines : lines.slice(0, 10);
}

function rel(absolute: string): string {
  return path.relative(REPO_ROOT, absolute).replaceAll("\\", "/");
}

async function readSources(patterns: string[]): Promise<SourceFileInput[]> {
  const out: SourceFileInput[] = [];
  for (const pattern of patterns) {
    for await (const match of new Glob(pattern).scan(REPO_ROOT)) {
      const file = match.replaceAll("\\", "/");
      if (file.includes("/i18n/en/") || file.includes("/i18n/ru/")) continue;
      // The generator owns these and they are excluded from Biome for the same reason.
      if (/i18n-(types|util|util\.sync|util\.async|react)\.tsx?$/.test(file)) continue;
      out.push({ path: file, text: readFileSync(path.join(REPO_ROOT, match), "utf8") });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Catalogs
// ---------------------------------------------------------------------------------------------

const base = (await import(path.join(CATALOG_DIR, BASE_LOCALE, "index.ts"))).default as CatalogNode;
const namespaces = Object.keys(base).sort();

/**
 * Locales are discovered from the catalog directory rather than from `LOCALES` in core, so a folder
 * added without the matching protocol entry (or the reverse) surfaces as a structural failure
 * instead of being silently skipped.
 */
const localeDirs: string[] = [];
for await (const entry of new Glob("*/index.ts").scan(CATALOG_DIR)) {
  localeDirs.push(entry.replaceAll("\\", "/").split("/")[0] ?? "");
}
const locales = localeDirs.filter(Boolean).sort();
const translations = locales.filter((locale) => locale !== BASE_LOCALE);

// --- structure -------------------------------------------------------------------------------

const structureProblems: string[] = [];
for (const locale of locales) {
  const files: string[] = [];
  for await (const entry of new Glob("*.ts").scan(path.join(CATALOG_DIR, locale))) {
    const name = entry.replaceAll("\\", "/").replace(/\.ts$/, "");
    if (name !== "index") files.push(name);
  }
  files.sort();
  const missing = namespaces.filter((ns) => !files.includes(ns));
  const extra = files.filter((file) => !namespaces.includes(file));
  for (const ns of missing) {
    structureProblems.push(
      `${locale}/${ns}.ts is missing — every namespace needs a file per locale`,
    );
  }
  for (const file of extra) {
    structureProblems.push(`${locale}/${file}.ts is not wired into ${locale}/index.ts`);
  }
}
if (structureProblems.length > 0) {
  row("structure", `${structureProblems.length} problem(s)`, "FAIL");
  report(true, "structure", "catalog structure", detailsOf("structure", structureProblems));
} else {
  row("structure", `${locales.length} locales × ${namespaces.length} namespaces`, "OK");
}

// --- parity, params, plurals ------------------------------------------------------------------

const coverage: string[] = [];
let orphanCount = 0;
let shapeCount = 0;
let unknownParamCount = 0;
let droppedParamCount = 0;
let typedParamCount = 0;
let pluralFatalCount = 0;
let zeroDiffersCount = 0;

const orphanDetails: string[] = [];
const shapeDetails: string[] = [];
const unknownDetails: string[] = [];
const droppedDetails: string[] = [];
const typedDetails: string[] = [];
const pluralDetails: string[] = [];
const zeroDetails: string[] = [];

const format = (locale: string, finding: Finding) =>
  `${locale}: ${finding.where} — ${finding.detail}`;

for (const locale of translations) {
  // The **raw** namespace modules, never `<locale>/index.ts` — that one is `deepMerge(en, …)` and
  // has perfect parity by construction, so measuring against it would report 100% coverage forever.
  const raw: CatalogNode = {};
  for (const ns of namespaces) {
    raw[ns] = (await import(path.join(CATALOG_DIR, locale, `${ns}.ts`))).default as CatalogNode;
  }

  const parity = compareCatalogs(base, raw);
  orphanCount += parity.orphans.length;
  shapeCount += parity.shapeMismatches.length;
  orphanDetails.push(...parity.orphans.map((f) => format(locale, f)));
  shapeDetails.push(...parity.shapeMismatches.map((f) => format(locale, f)));
  const percent = parity.total === 0 ? 100 : Math.round((parity.translated / parity.total) * 100);
  coverage.push(`${locale}: ${parity.translated}/${parity.total} keys (${percent}%)`);

  const params = compareParams(base, raw);
  unknownParamCount += params.unknown.length;
  droppedParamCount += params.dropped.length;
  typedParamCount += params.typed.length;
  unknownDetails.push(...params.unknown.map((f) => format(locale, f)));
  droppedDetails.push(...params.dropped.map((f) => format(locale, f)));
  typedDetails.push(...params.typed.map((f) => format(locale, f)));

  const plurals = checkPlurals(base, raw, locale, BASE_LOCALE);
  pluralFatalCount += plurals.badSlotCount.length + plurals.groupCountMismatch.length;
  zeroDiffersCount += plurals.zeroDiffers.length;
  pluralDetails.push(
    ...plurals.badSlotCount.map((f) => `${f.where} — ${f.detail}`),
    ...plurals.groupCountMismatch.map((f) => `${locale}: ${f.where} — ${f.detail}`),
  );
  zeroDetails.push(...plurals.zeroDiffers.map((f) => `${f.where} — ${f.detail}`));
}

if (orphanCount > 0) {
  row("parity", `${orphanCount} orphan(s)`, "FAIL");
  report(
    true,
    "orphans",
    "keys present in a translation but not in en — dead weight, or a typo deepMerge would inject",
    detailsOf("orphans", orphanDetails),
  );
} else if (shapeCount === 0) {
  row("parity", "0 orphans, 0 shape mismatches", "OK");
}
if (shapeCount > 0) {
  row("parity/shape", `${shapeCount} mismatch(es)`, "FAIL");
  report(
    true,
    "shape",
    "a leaf on one side and a branch on the other — deepMerge would render [object Object]",
    detailsOf("shape", shapeDetails),
  );
}

row("coverage", coverage.join(", ") || "no translations", "OK");

if (unknownParamCount > 0) {
  row("params", `${unknownParamCount} unknown`, "FAIL");
  report(
    true,
    "params",
    "a {param} the base catalog does not declare — this ships a literal {name} to users",
    detailsOf("params", unknownDetails),
  );
} else {
  row("params", "0 unknown", "OK");
}
if (droppedParamCount > 0) {
  row("params/dropped", `${droppedParamCount} dropped`, STRICT ? "FAIL" : "WARN");
  report(
    false,
    "params-dropped",
    "the base declares a {param} the translation omits — verify each is deliberate",
    detailsOf("params-dropped", droppedDetails),
  );
}
if (typedParamCount > 0) {
  row("params/typed", `${typedParamCount} typed`, STRICT ? "FAIL" : "WARN");
  report(
    false,
    "params-typed",
    "translations use the bare runtime form {count}; only the base catalog declares {count:number}",
    detailsOf("params-typed", typedDetails),
  );
}

if (pluralFatalCount > 0) {
  row("plurals", `${pluralFatalCount} bad`, "FAIL");
  report(
    true,
    "plurals",
    `plural groups are positional — a locale needing ${requiredSlotCount("ru")} slots renders an ` +
      "empty word if given four or five",
    detailsOf("plurals", pluralDetails),
  );
} else {
  row("plurals", "slot counts OK", "OK");
}
if (zeroDiffersCount > 0) {
  row("plurals/zero", `${zeroDiffersCount} differ`, STRICT ? "FAIL" : "WARN");
  report(
    false,
    "plurals-zero",
    'the zero slot differs from many — legitimate for phrasings like "нет файлов", usually a slip',
    detailsOf("plurals-zero", zeroDetails),
  );
}

// --- pre-mount script drift ---------------------------------------------------------------------

const meta = (await import(path.join(CATALOG_DIR, "locale-meta.ts"))) as {
  LOCALE_META: Record<string, { script: string }>;
};
const html = readFileSync(INDEX_HTML, "utf8");
const langScripts = /LANG_SCRIPTS\s*=\s*\{([^}]*)\}/.exec(html)?.[1];
if (!langScripts) {
  row("pre-mount", "LANG_SCRIPTS not found", "FAIL");
  report(
    true,
    "pre-mount",
    `could not find the LANG_SCRIPTS literal in ${rel(INDEX_HTML)} — the pre-mount script stamps ` +
      "lang/dir/data-lang-script before React mounts, and this check is what keeps it in sync",
  );
} else {
  const stamped = new Map<string, string>();
  for (const entry of langScripts.matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) {
    stamped.set(entry[1] ?? "", entry[2] ?? "");
  }
  const drift: string[] = [];
  for (const [locale, entry] of Object.entries(meta.LOCALE_META)) {
    const found = stamped.get(locale);
    if (found === undefined) drift.push(`${locale} is missing from index.html's LANG_SCRIPTS`);
    else if (found !== entry.script)
      drift.push(`${locale}: index.html "${found}" ≠ "${entry.script}"`);
  }
  for (const locale of stamped.keys()) {
    if (!(locale in meta.LOCALE_META)) drift.push(`${locale} in index.html is not in LOCALE_META`);
  }
  if (drift.length > 0) {
    row("pre-mount", `${drift.length} drift`, "FAIL");
    report(true, "pre-mount", "index.html duplicates the locale→script map", drift);
  } else {
    row("pre-mount", "LANG_SCRIPTS in sync", "OK");
  }
}

// ---------------------------------------------------------------------------------------------
// Call sites
// ---------------------------------------------------------------------------------------------

if (!FAST) {
  const sources = await readSources([
    `${UI_SRC}/**/*.ts`,
    `${UI_SRC}/**/*.tsx`,
    "packages/desktop/src/renderer/**/*.ts",
    "packages/desktop/src/renderer/**/*.tsx",
  ]);
  const tsx = sources.filter((file) => file.path.endsWith(".tsx"));

  // --- unused keys ----------------------------------------------------------------------------

  const usage = collectUsedKeys(sources, namespaces);
  if (usage.unresolved.length > 0) {
    row("resolver", `${usage.unresolved.length} file(s)`, "FAIL");
    report(
      true,
      "resolver",
      "a file names LL but no catalog path resolved — the AST passes have a gap and the unused-key " +
        "report below cannot be trusted until it is closed",
      usage.unresolved.map((f) => `${f.path} — ${f.reason}`),
    );
  } else {
    row("resolver", `${sources.length} files, 0 gaps`, "OK");
  }

  const unused = unusedKeys(leafPaths(base).keys(), usage);
  if (unused.length > 0) {
    row("unused keys", `${unused.length}`, STRICT ? "FAIL" : "WARN");
    report(
      false,
      "unused",
      "catalog keys with no reachable call site",
      detailsOf("unused", unused),
    );
  } else {
    row("unused keys", "0", "OK");
  }

  // --- malformed exemptions -------------------------------------------------------------------

  const malformed: string[] = [];
  for (const file of sources) {
    for (const entry of collectExemptions(file.text).malformed) {
      malformed.push(`${file.path}:${entry.line} — ${entry.text}`);
    }
  }
  if (malformed.length > 0) {
    row("exemptions", `${malformed.length} without a reason`, "FAIL");
    report(
      true,
      "exemptions",
      "i18n-exempt needs a reason of at least three characters, or it is a blanket suppression by another name",
      detailsOf("exemptions", malformed),
    );
  } else {
    row("exemptions", `${EXEMPT_GLOBS.length} path globs`, "OK");
  }

  // --- the ratchet ------------------------------------------------------------------------------

  const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as Baseline;

  const tally = (scan: (file: SourceFileInput) => ScanFinding[]) => {
    const counts: Record<string, number> = {};
    const findings: ScanFinding[] = [];
    for (const file of tsx) {
      const hits = scan(file);
      if (hits.length > 0) counts[file.path] = hits.length;
      findings.push(...hits);
    }
    return { counts, findings };
  };

  const hardcoded = tally(scanHardcodedStrings);
  const frozen = tally(scanFrozenTables);

  const gate = (
    name: string,
    counts: Record<string, number>,
    findings: ScanFinding[],
    recorded: Record<string, number>,
  ) => {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const recordedTotal = Object.values(recorded).reduce((sum, n) => sum + n, 0);
    const regressions: string[] = [];
    for (const [file, count] of Object.entries(counts)) {
      const allowed = recorded[file] ?? 0;
      if (count > allowed) {
        const lines = findings
          .filter((f) => f.path === file)
          .map((f) => `    ${f.path}:${f.line}  ${f.reason}  ${JSON.stringify(f.text)}`);
        regressions.push(`${file}: ${count} > ${allowed} (baseline)`, ...lines);
      }
    }
    if (regressions.length > 0) {
      row(name, `${total} (baseline ${recordedTotal})`, "FAIL");
      report(
        true,
        name,
        `new ${name} — route the string through the catalog, or mark it // i18n-exempt: <reason>`,
        detailsOf(name, regressions),
      );
    } else {
      row(name, `${total} (baseline ${recordedTotal})`, total > 0 ? "WARN" : "OK");
    }
    return counts;
  };

  if (UPDATE_BASELINE) {
    const previous =
      Object.values(baseline.hardcoded).reduce((s, n) => s + n, 0) +
      Object.values(baseline.frozenTables).reduce((s, n) => s + n, 0);
    const next =
      Object.values(hardcoded.counts).reduce((s, n) => s + n, 0) +
      Object.values(frozen.counts).reduce((s, n) => s + n, 0);
    if (next > previous && !ALLOW_INCREASE) {
      console.error(
        `\n✗ refusing to raise the baseline from ${previous} to ${next}.\n` +
          "  Route the new strings through the catalog, or re-run with --allow-increase and put " +
          "the reason in the commit.\n",
      );
      process.exit(1);
    }
    const updated: Baseline = {
      note: baseline.note,
      hardcoded: Object.fromEntries(Object.entries(hardcoded.counts).sort()),
      frozenTables: Object.fromEntries(Object.entries(frozen.counts).sort()),
    };
    writeFileSync(BASELINE_FILE, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    console.log(`i18n-baseline.json: ${previous} → ${next}`);
    process.exit(0);
  }

  gate("hardcoded strings", hardcoded.counts, hardcoded.findings, baseline.hardcoded);
  gate("frozen option tables", frozen.counts, frozen.findings, baseline.frozenTables);
} else {
  row("call sites", "skipped (--fast)", "OK");
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------

const width = Math.max(...rows.map((r) => r.label.length));
console.log(`\ni18n-check — ${UI_SRC}\n`);
for (const entry of rows) {
  const dots = ".".repeat(Math.max(2, width + 4 - entry.label.length));
  console.log(`  ${entry.label} ${dots} ${entry.value.padEnd(46)} ${entry.status}`);
}
console.log("");

const fatal = problems.filter((p) => p.fatal);
const warnings = problems.filter((p) => !p.fatal);

for (const problem of [...warnings, ...fatal]) {
  console.log(`${problem.fatal ? "FATAL" : "WARN "}  ${problem.message}`);
  for (const detail of problem.details) console.log(`        ${detail}`);
  if (!LIST && problem.details.length === 10) {
    console.log(`        (full list: bun run i18n:check --list ${problem.check})`);
  }
  console.log("");
}

console.log(
  `${fatal.length} error${fatal.length === 1 ? "" : "s"}, ` +
    `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
);

process.exit(fatal.length > 0 ? 1 : 0);
