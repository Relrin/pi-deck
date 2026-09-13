import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `shell` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * `{mod}` is the platform modifier glyph printed on the physical key, and the `,` / `` ` ``
 * characters beside it are the keys themselves — all three pass through untranslated.
 *
 * The four `screenSwitcher` labels render uppercase in a fixed-width footer control, so they are
 * kept as short as Russian allows: `СЕССИЯ` / `РЕДАКТОР` / `ДИФФ` / `ПУСТО`. `РЕДАКТОР` is the
 * long one at 8 glyphs against `EDITOR`'s 6 — see the label-budget test.
 */
const shell = {
  topBar: {
    backToStart: "На главный экран",
    leftPanel: {
      show: "Показать левую панель",
      hide: "Скрыть левую панель",
    },
    bottomPanel: {
      show: "Показать нижнюю панель",
      hide: "Скрыть нижнюю панель",
    },
    rightPanel: {
      show: "Показать правую панель",
      hide: "Скрыть правую панель",
    },
  },

  settings: {
    open: "Открыть настройки",
    shortcutTooltip: "Настройки ({mod}+,)",
  },

  terminal: {
    toggle: "Показать или скрыть терминал",
    shortcutTooltip: "Терминал ({mod}+`)",
  },

  leftRail: {
    label: "Левая панель",
    tabs: "Вкладки левой панели",
    sessions: "Сессии",
    files: "Файлы",
  },

  rightPane: {
    label: "Правая панель",
    tabs: "Вкладки правой панели",
    session: "Сессия",
    git: "Git",
    context: "Контекст",
  },

  screenSwitcher: {
    label: "Переключить экран",
    sessionGate: "Сначала откройте сессию",
    session: "СЕССИЯ",
    editor: "РЕДАКТОР",
    diff: "ДИФФ",
    blank: "ГЛАВНАЯ",
  },

  resize: {
    leftRail: "Изменить ширину левой панели",
    rightPane: "Изменить ширину правой панели",
    terminalPanel: "Изменить высоту панели терминала",
  },

  windowControls: {
    minimize: "Свернуть",
    maximize: "Развернуть",
    restore: "Восстановить",
  },

  footer: {
    screen: "экран",
  },

  sessionPane: {
    loading: "Загрузка сессии…",
  },

  components: {
    confirmDialog: {
      confirm: "Подтвердить",
    },
    stepper: {
      increase: "Увеличить: {label}",
      decrease: "Уменьшить: {label}",
      increaseBare: "Увеличить",
      decreaseBare: "Уменьшить",
    },
    chipPicker: {
      header: "Выбрать",
    },
  },
} as const satisfies DeepPartial<Translation["shell"]>;

export default shell;
