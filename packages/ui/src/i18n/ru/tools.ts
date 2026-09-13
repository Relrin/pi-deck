import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `tools` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * `{tool}` is a pi tool name (`read`, `bash`, `edit`, `write`) and passes through untranslated.
 */
const tools = {
  session: {
    title: "Инструменты сессии",
    titleWithCount: "Инструменты сессии (выключено: {count})",
    blurb:
      "Действует только для этой сессии. Значение по умолчанию для новых сессий задаётся в Настройках — Инструменты.",
  },

  allOffWarning:
    "Если выключить все инструменты, агент сможет только отвечать текстом: он не сможет ни читать, ни изменять файлы.",

  toggle: {
    enabled: "{tool}: включён",
    disabled: "{tool}: выключен",
  },

  catalog: {
    read: "Читать файлы проекта.",
    bash: "Выполнять команды через Shell или Bash.",
    edit: "Изменять существующие файлы.",
    write: "Создавать новые файлы.",
  },

  errors: {
    update: "Не удалось обновить инструменты",
  },
} as const satisfies DeepPartial<Translation["tools"]>;

export default tools;
