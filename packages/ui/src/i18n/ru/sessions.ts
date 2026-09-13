import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `sessions` namespace. Deliberately partial — anything omitted falls
 * back to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * `title.new` is the name a newly created session is *stored* under, so it is translated once, at
 * creation, and then stays as written — like any other name the user can edit. Forked and
 * discovered sessions keep the host's English titles; see the note in `../en/sessions.ts`.
 */
const sessions = {
  filter: {
    selectedCount: "выбрано: {count}",
    label: "Фильтровать сессии",
    controls: "Сортировка, группировка и фильтры сессий",
    searchPlaceholder: "фильтр сессий…",
    projectPlaceholder: "фильтр проектов…",
    all: "Все",
    noMatches: "совпадений нет",
    defaults: "по умолчанию",
    activeCount: "активно: {count}",
    reset: "сбросить",
    done: "готово",
    summaryAll: "все",
    summaryNone: "ничего",
    section: {
      project: "проект",
      since: "период",
      sort: "сортировка",
      group: "группировка",
    },
    since: {
      all: "всё",
    },
    sort: {
      recent: "по активности",
      created: "по созданию",
      branch: "по ветке",
      status: "по статусу",
    },
    group: {
      workspace: "по проекту",
      branch: "по ветке",
      status: "по статусу",
      flat: "без группировки",
    },
  },

  title: {
    new: "Новая сессия",
  },

  newButton: {
    label: "Новая сессия",
    disabled: "Сначала откройте проект",
    caption: "новая сессия",
  },

  list: {
    archive: "архив",
    showLess: "свернуть",
    showMore: "ещё {count}",
    noProjects: "нет проектов",
    noProjectsMatch: "нет проектов по фильтру",
  },

  row: {
    title: "Название сессии",
    status: {
      working: "Выполняется",
      waiting: "Ожидает вашего ответа",
      done: "Завершено",
      failed: "Ошибка",
    },
    menu: {
      markCompleted: "Отметить как завершённую",
      rename: "Переименовать",
      unarchive: "Вернуть из архива",
      archive: "В архив",
      delete: "Удалить",
    },
    confirmDeleteTitle: "Удалить сессию?",
    confirmDeleteBody:
      "«{title}» и вся её история будут удалены безвозвратно. Отменить это действие нельзя.",
    confirmDeleteLabel: "Удалить",
  },

  errors: {
    loadWorkspace: "Не удалось загрузить рабочую область",
    loadSessions: "Не удалось загрузить сессии",
    createSession: "Не удалось создать сессию",
    loadArchived: "Не удалось загрузить архивные сессии",
    archive: "Не удалось отправить сессию в архив",
    unarchive: "Не удалось вернуть сессию из архива",
    rename: "Не удалось переименовать сессию",
    delete: "Не удалось удалить сессию",
    open: "Не удалось открыть сессию",
    sendPrompt: "Не удалось отправить запрос",
    cancel: "Не удалось отменить",
    forceStop: "Не удалось принудительно остановить",
    fork: "Не удалось разветвить сессию",
    rewind: "Не удалось откатить к сообщению",
    openProject: "Не удалось открыть проект",
    loadProjects: "Не удалось загрузить проекты",
    noBridge: "Мост preload недоступен",
    noConnectionInfo: "Бэкенд не передал данные для подключения",
  },
} as const satisfies DeepPartial<Translation["sessions"]>;

export default sessions;
