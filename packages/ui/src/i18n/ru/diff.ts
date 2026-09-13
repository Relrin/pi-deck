import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `diff` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * Six plural slots, `zero|one|two|few|many|other`, as every Russian plural here needs: the parser
 * reads them positionally, so four or five entries leave `many`/`other` undefined and render an
 * empty word. `two` never selects in Russian but must still carry text.
 */
const diff = {
  commitFiles: "коммит · {count} {{файлов|файл|файла|файла|файлов|файлов}}",
  revertAllConfirm:
    "Будет возвращено к HEAD: {count} {{файлов|файл|файла|файла|файлов|файлов}} (неотслеживаемые файлы будут удалены). Отменить это действие нельзя.",

  tab: {
    pickFile: "Выберите файл в git-панели, чтобы увидеть его дифф.",
    loading: "Загрузка диффа…",
    noChanges: "Нет изменений относительно HEAD.",
  },

  nav: {
    label: "Навигация по диффу",
    prevDiff: "Предыдущее изменение",
    nextDiff: "Следующее изменение",
    jumpToSource: "Перейти к коду",
    prevFile: "Сравнить предыдущий файл",
    nextFile: "Сравнить следующий файл",
  },

  toolbar: {
    label: "Параметры отображения диффа",
    switchToUnified: "Переключиться на унифицированный вид",
    switchToSplit: "Переключиться на вид бок о бок",
    layoutSplitTitle: "Вид бок о бок · нажмите для единого",
    layoutUnifiedTitle: "Единый вид · нажмите для вида бок о бок",
    backgroundDisable: "Убрать фон строк",
    backgroundEnable: "Показать фон строк",
    backgroundOnTitle: "Фон для заголовков включён · нажмите, чтобы скрыть",
    backgroundOffTitle: "Фон для заголовков выключен · нажмите, чтобы показать",
    highlight: "Подсветка изменений внутри строки",
    lineDiff: {
      wordAlt: {
        label: "Word-Alt",
        description: "Подсвечивать слова целиком",
      },
      word: { label: "Word", description: "Подсвечивать изменённые слова внутри строк" },
      char: { label: "Character", description: "Подсвечивать отдельные символы" },
      none: { label: "None", description: "Только построчные изменения" },
    },
  },

  changeset: {
    eyebrow: "ревью · набор изменений",
    fileCount: "{count} {{файлов|файл|файла|файла|файлов|файлов}}",
    revertAll: "Сбросить все изменения",
    revertAllNothing: "Нет изменений",
    revertAllTitle: "Отменить все изменения относительно HEAD в git",
    stageHunks: "выбрать фрагменты",
    stageNothing: "Выбирать нечего",
    stageTitle: "Выбрать все изменённые файлы для следующего коммита",
    commit: "коммит",
    commitNothing: "Коммитить нечего",
    commitTitle: "Перейти к форме коммита",
    confirmTitle: "Отменить все изменения рабочего дерева?",
    confirmLabel: "Отменить всё",
  },
} as const satisfies DeepPartial<Translation["diff"]>;

export default diff;
