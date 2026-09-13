import { describe, expect, test } from "bun:test";
import { loadLocale } from "../../src/i18n/i18n-util.sync";
import { llFor } from "../../src/i18n/t";

// `test/setup.ts` sync-loads only `en`. Never `mock.module` the i18n modules — they are
// process-global and unrevertable, and `bun test`'s file order is OS-dependent.
loadLocale("ru");

/**
 * typesafe-i18n plurals are **positional** — `{{zero|one|two|few|many|other}}` — with no named
 * form, and it routes `0` to the `zero` slot rather than to the category `Intl.PluralRules`
 * reports. For Russian that category is `many`, so every Russian plural has to repeat its `many`
 * text in the `zero` slot. Getting 11 and 21 right is the entire reason for using real plural
 * rules instead of an `n === 1` ternary: 21 takes the singular and 11 does not.
 */
describe("Russian plural forms", () => {
  const ru = llFor("ru");

  test("`Intl.PluralRules` reports the four categories the catalogs are written against", () => {
    const categories = new Intl.PluralRules("ru").resolvedOptions().pluralCategories;
    expect([...categories].sort()).toEqual(["few", "many", "one", "other"]);
    const select = (n: number) => new Intl.PluralRules("ru").select(n);
    expect(select(1)).toBe("one");
    expect(select(2)).toBe("few");
    expect(select(5)).toBe("many");
    expect(select(11)).toBe("many");
    expect(select(21)).toBe("one");
  });

  test("files decline correctly across the tricky counts", () => {
    const files = (count: number) => String(ru.chat.review.fileCount({ count }));
    expect(files(1)).toBe("1 файл");
    expect(files(2)).toBe("2 файла");
    expect(files(5)).toBe("5 файлов");
    expect(files(11)).toBe("11 файлов");
    expect(files(21)).toBe("21 файл");
  });

  test("the `zero` slot repeats the `many` text, because 0 never reaches CLDR's category", () => {
    expect(String(ru.chat.review.fileCount({ count: 0 }))).toBe("0 файлов");
    expect(String(ru.files.moreItems({ count: 0 }))).toContain("элементов");
  });

  test("a plural that selects without printing its count still declines", () => {
    // The review banner renders the number as a separate badge, so `filesChanged` uses the
    // `{{count:…}}` form. The verb agrees with the noun, so only `one` reads "изменён".
    expect(String(ru.chat.review.filesChanged({ count: 1 }))).toBe("файл изменён");
    expect(String(ru.chat.review.filesChanged({ count: 2 }))).toBe("файла изменено");
    expect(String(ru.chat.review.filesChanged({ count: 5 }))).toBe("файлов изменено");
    expect(String(ru.chat.review.filesChanged({ count: 21 }))).toBe("файл изменён");
  });

  test("every converted plural declines rather than repeating one form", () => {
    const cases: Array<[string, string, string]> = [
      [
        ru.files.confirmDeleteTitle({ count: 1 }),
        ru.files.confirmDeleteTitle({ count: 2 }),
        ru.files.confirmDeleteTitle({ count: 5 }),
      ],
      [
        ru.chat.tools.moreLines({ count: 1 }),
        ru.chat.tools.moreLines({ count: 2 }),
        ru.chat.tools.moreLines({ count: 5 }),
      ],
      [
        ru.chat.tools.editCount({ count: 1 }),
        ru.chat.tools.editCount({ count: 2 }),
        ru.chat.tools.editCount({ count: 5 }),
      ],
      [
        ru.chat.planSnapshot.moreSteps({ count: 1 }),
        ru.chat.planSnapshot.moreSteps({ count: 2 }),
        ru.chat.planSnapshot.moreSteps({ count: 5 }),
      ],
      [
        ru.chat.planComments.count({ count: 1 }),
        ru.chat.planComments.count({ count: 2 }),
        ru.chat.planComments.count({ count: 5 }),
      ],
      [
        ru.chat.ask.sendChoices({ count: 1 }),
        ru.chat.ask.sendChoices({ count: 2 }),
        ru.chat.ask.sendChoices({ count: 5 }),
      ],
      [
        ru.diff.commitFiles({ count: 1 }),
        ru.diff.commitFiles({ count: 2 }),
        ru.diff.commitFiles({ count: 5 }),
      ],
      [
        ru.settings.skills.installedTitle({ count: 1 }),
        ru.settings.skills.installedTitle({ count: 2 }),
        ru.settings.skills.installedTitle({ count: 5 }),
      ],
    ];
    for (const [one, few, many] of cases) {
      // Strip the digits: what must differ is the word, not the number in front of it.
      const word = (s: string) => s.replace(/\d+/g, "");
      expect(word(one)).not.toBe(word(few));
      expect(word(few)).not.toBe(word(many));
    }
  });
});

describe("English plural forms are unchanged by the conversion", () => {
  const en = llFor("en");

  test("one/other is the whole story", () => {
    expect(String(en.chat.review.fileCount({ count: 1 }))).toBe("1 file");
    expect(String(en.chat.review.fileCount({ count: 2 }))).toBe("2 files");
    expect(String(en.chat.review.fileCount({ count: 0 }))).toBe("0 files");
  });

  test("converted call sites reproduce the strings they replaced", () => {
    expect(String(en.files.confirmDeleteTitle({ count: 1 }))).toBe("Move 1 item to Trash?");
    expect(String(en.files.confirmDeleteTitle({ count: 3 }))).toBe("Move 3 items to Trash?");
    expect(String(en.diff.commitFiles({ count: 1 }))).toBe("commit · 1 file");
    expect(String(en.diff.revertAllConfirm({ count: 1 }))).toBe(
      "This reverts 1 file to HEAD (untracked files are removed). This can't be undone.",
    );
    expect(String(en.chat.tools.editCount({ count: 1 }))).toBe("1 edit");
    expect(String(en.chat.ask.sendChoices({ count: 1 }))).toBe("Send 1 choice");
    expect(String(en.settings.skills.scanFoundLabel({ count: 2 }))).toBe("2 skills found");
  });
});
