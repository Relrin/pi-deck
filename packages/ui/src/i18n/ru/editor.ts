import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `editor` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * Untranslated on purpose: the encoding *names* (`UTF-8`, `Windows-1252`, `ISO-8859-1`), the
 * separator names `LF` / `CRLF`, the `{hint}` and `{server}` values interpolated from
 * language-server configuration, and `PATH`. Only the sentences around them are Russian.
 */
const editor = {
  empty: {
    title: "Нет открытых файлов",
    hint: "Выберите файл в дереве, чтобы открыть его здесь.",
  },

  overlay: {
    loading: "Загрузка…",
    openFailed: "Не удалось открыть файл",
    binary: "Двоичный файл — не отображается.",
    tooLarge: "Файл слишком большой, чтобы открыть его в редакторе.",
  },

  tabs: {
    label: "Открытые файлы",
    unsaved: "Несохранённые изменения",
    close: "Закрыть {name}",
    overflow: "ещё {count} {{файлов|файл|файла|файла|файлов|файлов}}",
  },

  status: {
    gotoTitle: "Перейти к строке / столбцу",
    cursor: "Стр. {line}, Стлб. {col}",
    selected: "(выделено: {count})",
    indentTabs: "Ширина табуляции: {width}",
    indentSpaces: "Пробелов: {width}",
    encodingTitle: "Выбрать кодировку (файл будет переоткрыт)",
    encodingMenuHead: "Переоткрыть в кодировке",
    bomSuffix: " · BOM",
    addBom: "Добавить BOM",
    eolTitle: "Выбрать разделитель строк",
    eolHintLf: "Unix (\\n)",
    eolHintCrlf: "Windows (\\r\\n)",
    reopenConfirmTitle: "Переоткрыть в другой кодировке?",
    reopenConfirmBody:
      "В файле есть несохранённые изменения. Если переоткрыть его в другой кодировке, они будут потеряны.",
    reopenConfirmLabel: "Отбросить и переоткрыть",
    encoding: {
      utf8: "UTF-8",
      utf16le: "UTF-16 LE",
      utf16be: "UTF-16 BE",
      win1252: "Западная (Windows-1252)",
      latin1: "Западная (ISO-8859-1)",
      ascii: "US-ASCII",
    },
  },

  goto: {
    title: "Перейти к строке:столбцу",
    description: "Введите номер строки или строку:столбец.",
    placeholder: "например, 120 или 120:8",
    label: "Строка и столбец",
    submit: "Перейти",
  },

  blockToolbar: {
    label: "Действия с блоком диффа",
    prev: "Предыдущее изменение",
    next: "Следующее изменение",
    revert: "Сбросить изменения этого блока",
    showDiff: "Показать дифф для строк",
  },

  minimap: {
    jumpTo: {
      add: "Перейти к добавленному изменению",
      mod: "Перейти к изменённому фрагменту",
      del: "Перейти к удалённому изменению",
    },
    kind: {
      add: "Добавлено",
      mod: "Изменено",
      del: "Удалено",
    },
  },

  lsp: {
    status: {
      ready: "Языковой сервер подключён",
      starting: "Языковой сервер запускается…",
      missing: "Языковой сервер не установлен",
      missingWithHint: "Языковой сервер не установлен — {hint}",
      crashed: "Языковой сервер аварийно завершился — {reason}",
      crashedFallback: "переоткройте файл, чтобы попробовать снова",
      disabled: "Языковой сервер отключён в Настройках → Редактор",
      diagnostics: "Диагностика языкового сервера для этого файла",
    },
    dialog: {
      addTitle: "Добавить языковой сервер",
      editTitle: "Изменить {label}",
      description:
        "Команда ищется в PATH окружения проекта — так же, как для встроенных серверов. Ничего не скачивается.",
      presetLabel: "Начать с шаблона (необязательно)",
      presetBlank: "Пусто",
      fieldLabel: "Название",
      fieldId: "Идентификатор",
      fieldIdHint:
        "Строчные буквы, цифры, дефисы. Не должен совпадать с идентификатором встроенного сервера.",
      fieldCommand: "Команда",
      fieldArgs: "Аргументы (необязательно)",
      fieldLanguageIds: "Идентификаторы языков",
      fieldLanguageIdsHint: "{code}, которые понимает сервер, через пробел.",
      fieldExtensions: "Расширения файлов",
      fieldExtensionsHint:
        "Без точек. Просто {bare} привяжется к первому идентификатору языка; {qualified} выбирает другой.",
      fieldInstallHint: "Подсказка по установке (необязательно)",
      fieldInstallHintHint: "Показывается, если команда не найдена в PATH.",
      submitting: "Сохранение…",
      saveChanges: "Сохранить изменения",
      addServer: "Добавить сервер",
      saveFailed: "Не удалось сохранить сервер",
    },
    crashToast: {
      title: "Языковой сервер {server} аварийно завершился",
      body: "Редактор вернулся к базовому автодополнению. Переоткройте файл, чтобы попробовать снова.",
    },
  },

  errors: {
    save: "Не удалось сохранить файл",
    open: "Не удалось открыть файл",
    notConnected: "Нет подключения",
  },
} as const satisfies DeepPartial<Translation["editor"]>;

export default editor;
