import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `terminal` namespace. Deliberately partial — anything omitted falls
 * back to the English string, per key, via `deepMerge` in `./index.ts`.
 */
const terminal = {
  new: {
    label: "Новый терминал",
    chooseType: "Выбрать тип терминала",
    noShells: "Оболочки не найдены",
    defaultBadge: "по умолчанию",
    settings: "Настройки терминала…",
  },

  tabs: {
    label: "Вкладки терминала",
    rename: "Переименовать терминал",
    close: "Закрыть {name}",
    closePanel: "Закрыть панель терминала",
  },

  view: {
    exited: "Процесс завершён",
    restart: "Перезапустить",
    starting: "Запуск терминала…",
    noProject: "Откройте проект, чтобы запустить терминал.",
  },
} as const satisfies DeepPartial<Translation["terminal"]>;

export default terminal;
