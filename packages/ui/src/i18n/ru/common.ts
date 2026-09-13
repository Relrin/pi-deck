import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `common` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 */
const common = {
  diff: {
    commitFiles: "коммит · {count} {{файлов|файл|файла|файла|файлов|файлов}}",
    revertAllConfirm:
      "Будет возвращено к HEAD: {count} {{файлов|файл|файла|файла|файлов|файлов}} (неотслеживаемые файлы будут удалены). Отменить это действие нельзя.",
  },

  files: {
    confirmDeleteTitle:
      "Переместить в корзину: {count} {{элементов|элемент|элемента|элемента|элементов|элементов}}?",
    moreItems: "+ ещё {count} {{элементов|элемент|элемента|элемента|элементов|элементов}}",
  },
} as const satisfies DeepPartial<Translation["common"]>;

export default common;
