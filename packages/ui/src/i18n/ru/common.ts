import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `common` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * The `error.host.*` table is keyed by `RouterError.code`. The host keeps its own English messages
 * as a fallback; these are what the user actually reads, so they are written as plain sentences
 * rather than as translations of the host's wording.
 */
const common = {
  cancel: "Отмена",
  close: "Закрыть",
  save: "Сохранить",
  remove: "Убрать",
  retry: "Повторить",
  dismiss: "Скрыть",

  error: {
    generic: "Что-то пошло не так",

    host: {
      notFound: "Этого элемента больше не существует.",
      invalidRequest: "Приложение отправило запрос, который бэкенд не может принять.",
      unknownCommand: "Приложение запросило то, что не поддерживается этой версией бэкенда.",
      registryFailed: "Не удалось связаться с реестром провайдеров.",
      pathEscape: "Этот путь находится вне папки проекта.",
      notARepo: "Эта папка не является git-репозиторием.",
      lspFailed: "Языковой сервер не смог выполнить запрос.",
      lspUnknownKey: "Этот языковой сервер не настроен.",
      lspMethodNotAllowed: "Языковой сервер не допускает такой запрос.",
      illegalName: "Такое имя недопустимо.",
      gitNotFound: "Git не установлен или отсутствует в PATH.",
      gitFailed: "Команда git завершилась с ошибкой.",
      fsFailed: "Операция с файлом не удалась.",
      fsExists: "Элемент с таким именем уже существует.",
      forbidden: "Это действие запрещено.",
    },

    hostEvent: "Ошибка хоста",
    promptError: "pi сообщил об ошибке запроса",

    transport: {
      authFailed: "Не удалось пройти аутентификацию на бэкенде.",
      disconnected: "Связь с бэкендом потеряна.",
      timedOut: "Бэкенд не ответил вовремя.",
    },
  },
} as const satisfies DeepPartial<Translation["common"]>;

export default common;
