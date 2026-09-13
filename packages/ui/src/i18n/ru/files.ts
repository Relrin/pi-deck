import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `files` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 */
const files = {
  confirmDeleteTitle:
    "Переместить в корзину: {count} {{элементов|элемент|элемента|элемента|элементов|элементов}}?",
  moreItems: "+ ещё {count} {{элементов|элемент|элемента|элемента|элементов|элементов}}",
  confirmDeleteDescription: "Элементы можно восстановить из корзины операционной системы.",
  confirmDeleteBusy: "Перемещение…",
  confirmDelete: "Переместить в корзину",

  tree: {
    label: "Файлы проекта",
  },

  search: {
    placeholder: "фильтр файлов…",
    label: "Фильтровать файлы",
    clear: "Очистить фильтр",
  },

  menu: {
    showDiff: "Показать дифф",
    newFile: "Новый файл",
    newFolder: "Новая папка",
    attachToChat: "Прикрепить к чату",
    rename: "Переименовать…",
    moveToTrash: "Переместить в корзину",
  },

  empty: {
    noProject: "Откройте проект, чтобы просмотреть его файлы.",
    emptyProject: "В этом проекте пока нет файлов.",
    noMatches: "Совпадений нет.",
    error: "Не удалось загрузить файлы.",
  },

  errors: {
    create: "Не удалось создать элемент",
    rename: "Не удалось переименовать",
    move: "Не удалось переместить",
    trash: "Не удалось переместить в корзину",
    load: "Не удалось загрузить файлы проекта",
  },
} as const satisfies DeepPartial<Translation["files"]>;

export default files;
