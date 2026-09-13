import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `context` namespace. Deliberately partial — anything omitted falls
 * back to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * `AGENTS.md` / `CLAUDE.md`, `MCP` and `{path}` are names and paths; they stay as they are.
 * `{tokens}`, `{used}` and `{total}` arrive already formatted.
 */
const context = {
  empty: "Начните или откройте сессию, чтобы увидеть контекст.",

  window: {
    label: "Контекст сессии",
    totals: "{used} / {total} ток.",
    usage: "Использование контекста: {percent}%",
    legend: {
      system: "система",
      project: "проект",
      chat: "чат",
      tools: "инструменты",
      mcp: "mcp",
      free: "доступно",
    },
    tooltip: {
      system: "Системный промпт — {tokens} токенов",
      project: "Контекст проекта (AGENTS.md, CLAUDE.md и т. п.) — {tokens} токенов",
      messages: "Сообщения — {tokens} токенов",
      tools: "Навыки и описания инструментов — {tokens} токенов",
      mcp: "Инструменты MCP — {tokens} токенов",
      free: "Свободное место — {tokens} токенов",
    },
  },

  scope: {
    label: "в контексте · {count}",
    empty:
      "Файлы и папки пока не добавлены. Укажите их, чтобы предоставить дополнительный контекст агенту.",
  },

  artefacts: {
    label: "создано артефактов · {count}",
    empty:
      "Пока ничего не создано. Новые файлы, которые напишет агент (планы, отчёты, сгенерированный код…), появятся здесь.",
  },

  tag: {
    file: "файл",
    folder: "папка",
    repoRef: "ссылка",
  },

  row: {
    openTitle: "Открыть в приложении по умолчанию",
    open: "Открыть {path}",
    revealTitle: "Показать в файловом менеджере",
    reveal: "Показать {path} в файловом менеджере",
  },

  errors: {
    openUnsupported: "Открытие файлов не поддерживается на этой платформе.",
    openFailed: "Не удалось открыть файл",
    revealUnsupported: "Показ в файловом менеджере здесь не поддерживается.",
    revealFailed: "Не удалось показать файл",
  },
} as const satisfies DeepPartial<Translation["context"]>;

export default context;
