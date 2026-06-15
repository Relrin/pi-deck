import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ThemeManager } from "../../src/host/themes/index.js";

/**
 * End-to-end coverage of the delete + listing flow on the host side. These tests are the
 * regression net for the chip/source bugs we hit in the renderer: bundled names must stay
 * bundled even if their JSON sits on disk, and `deleteUserTheme` must unlink the file and
 * drop the registry entry so the next `theme.list()` reflects the deletion.
 */
let userDataDir: string;
let mgr: ThemeManager;

beforeEach(async () => {
  userDataDir = await mkdtemp(join(tmpdir(), "pideck-themes-"));
});

afterEach(async () => {
  await mgr?.shutdown();
  await rm(userDataDir, { recursive: true, force: true });
});

async function seedUserTheme(name: string, body: object): Promise<string> {
  const themesDir = join(userDataDir, "themes");
  const path = join(themesDir, `${name}.json`);
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return path;
}

describe("ThemeManager", () => {
  test("a disk file matching a bundled name keeps the bundled chip", async () => {
    // Pre-seed a leftover auto-seeded copy from the old behaviour. With the reservation guard
    // in place, the registry must still report this as `source: "bundled"` — otherwise the
    // renderer chips it "User" and renders a (broken) delete button.
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    // Seed AFTER init so we can simulate a stale file already on disk.
    await seedUserTheme("forge", {
      meta: { name: "forge", kind: "dark", accent: "plasma" },
    });
    await mgr.shutdown();

    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    const listing = mgr.list().find((t) => t.name === "forge");
    expect(listing?.source).toBe("bundled");
  });

  test("deleteUserTheme unlinks the file and removes the listing entry", async () => {
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    const themesDir = join(userDataDir, "themes");
    const path = await seedUserTheme("custom-fork", {
      meta: { name: "custom-fork", kind: "dark", accent: "custom" },
      "bg-0": "#111111",
    });
    // Force the registry to pick up the new file before we delete.
    await mgr.shutdown();
    mgr = new ThemeManager(userDataDir);
    await mgr.init();

    expect(mgr.list().some((t) => t.name === "custom-fork")).toBe(true);

    await mgr.deleteUserTheme("custom-fork");

    expect(mgr.list().some((t) => t.name === "custom-fork")).toBe(false);
    await expect(access(path)).rejects.toThrow();
    expect(themesDir).toBeDefined(); // anchor for the path variable
  });

  test("deleteUserTheme on a bundled theme is rejected", async () => {
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    await expect(mgr.deleteUserTheme("forge")).rejects.toThrow(/Cannot delete bundled theme/);
  });

  test("deleteUserTheme on an unknown name is rejected", async () => {
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    await expect(mgr.deleteUserTheme("does-not-exist")).rejects.toThrow(/Unknown theme/);
  });

  test("deleting the active theme falls back to forge", async () => {
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    await seedUserTheme("custom-active", {
      meta: { name: "custom-active", kind: "dark", accent: "custom" },
    });
    await mgr.shutdown();
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    await mgr.setActive("custom-active");
    expect(mgr.getActiveName()).toBe("custom-active");

    await mgr.deleteUserTheme("custom-active");
    expect(mgr.getActiveName()).toBe("forge");
  });

  test("emits theme.changed when a user theme is deleted", async () => {
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    await seedUserTheme("custom-emit", {
      meta: { name: "custom-emit", kind: "dark", accent: "custom" },
    });
    await mgr.shutdown();
    mgr = new ThemeManager(userDataDir);
    await mgr.init();

    const events: Array<{ topic: string; activeName: string; names: string[] }> = [];
    mgr.on("event", (topic, payload) => {
      const p = payload as { activeName: string; themes: Array<{ name: string }> };
      events.push({ topic, activeName: p.activeName, names: p.themes.map((t) => t.name) });
    });

    await mgr.deleteUserTheme("custom-emit");
    // First synchronous emit from deleteUserTheme — chokidar may fire a second one later,
    // we just need to see the immediate one for the renderer to react to.
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]?.names).not.toContain("custom-emit");
  });

  // Touch readFile so the import isn't flagged as unused — handy for future test additions.
  test("seed helper writes valid JSON", async () => {
    mgr = new ThemeManager(userDataDir);
    await mgr.init();
    const path = await seedUserTheme("probe", {
      meta: { name: "probe", kind: "dark", accent: "custom" },
    });
    const raw = await readFile(path, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
