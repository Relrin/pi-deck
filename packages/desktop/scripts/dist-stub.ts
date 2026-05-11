#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_DIR = join(import.meta.dir, "..");
const OUT_DIR = join(PACKAGE_DIR, "out");
const PLATFORM = process.platform;
const ARCH = process.arch;
const FILENAME = `pi-deck-stub-${PLATFORM}-${ARCH}.txt`;

mkdirSync(OUT_DIR, { recursive: true });

const body = [
  "pi-deck placeholder build artefact.",
  "",
  `platform: ${PLATFORM}`,
  `arch:     ${ARCH}`,
  `node:     ${process.version}`,
  "",
].join("\n");

const target = join(OUT_DIR, FILENAME);
writeFileSync(target, body);
console.log(`Wrote ${target}`);
