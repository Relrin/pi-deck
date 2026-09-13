import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `models` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * `{provider}` is a provider name and `{path}` a file path; both pass through untranslated. So do
 * `API key`, `OAuth` and `PATH` where they name the thing itself rather than describe it.
 */
const models = {
  picker: {
    title: "Выбрать модель",
    close: "Закрыть",
  },

  providers: {
    heading: "Провайдеры",
    custom: "Пользовательский",
    addCustom: "Добавить…",
    addCustomLabel: "Добавить своего провайдера",
    state: {
      authenticated: "Подключён",
      needsKey: "Нужен API-ключ",
      unreachable: "Недоступен",
    },
  },

  list: {
    pickProvider: "Выберите провайдера, чтобы увидеть модели.",
    needsKey: "Для {provider} нужен API-ключ.",
    addKey: "Добавить API-ключ",
    filter: "Фильтр моделей",
    loading: "Загрузка моделей…",
    noMatches: "Совпадений нет.",
    noModels: "Модели не найдены.",
    chipContext: "конт.",
    chipPriceIn: "вход",
    chipPriceOut: "/ выход",
    chipThinking: "рассуждения",
  },

  addProvider: {
    eyebrow: "провайдеры · pi",
    title: "Добавить провайдера",
    description:
      "Выберите провайдера и добавьте API-ключ. Его модели появятся в списке, как только ключ будет сохранён.",
    escHint: "esc",
    search: "Поиск провайдеров — имя или переменная окружения…",
    allConfigured:
      "У всех встроенных провайдеров уже есть ключ. Управлять ими можно на предыдущем экране.",
    noMatches: "Нет подходящих провайдеров",
    addKey: "Добавить ключ",
    available: "доступно: {count}",
    keysSavedTo: "ключи сохраняются в {path}",
  },

  authenticate: {
    title: "Подключить {provider}",
    titleFallback: "провайдера",
    description:
      "Вставьте API-ключ — он передаётся хост-процессу и хранится в файле аутентификации pi, обратно в чат не возвращается.",
    apiKey: "API-ключ",
    storageHint: "Хранится в {path} (права 0600). Никогда не логируется и не возвращается в чат.",
    oauthTitle: "OAuth появится в одном из будущих обновлений",
    oauth: "Войти через OAuth {provider} (скоро)",
    submitting: "Сохранение…",
    submit: "Сохранить и проверить",
    saveFailed: "Не удалось сохранить API-ключ",
  },

  addCustom: {
    title: "Добавить своего провайдера",
    description:
      "Подключите OpenAI-совместимый эндпоинт — LM Studio, Ollama, vLLM или собственный шлюз.",
    name: "Название",
    baseUrl: "Базовый URL",
    apiKind: "Тип API",
    apiKey: "API-ключ (необязательно)",
    apiKeyPlaceholder: "Оставьте пустым для эндпоинтов без аутентификации",
    defaultModel: "Идентификатор модели по умолчанию (необязательно)",
    defaultModelHint: "Используется, если эндпоинт не отдаёт {path}.",
    submitting: "Сохранение…",
    submit: "Добавить провайдера",
    saveFailed: "Не удалось добавить провайдера",
  },

  errors: {
    loadProviders: "Не удалось загрузить провайдеров",
    loadModels: "Не удалось загрузить модели",
    switchModel: "Не удалось переключить модель",
    setThinkingLevel: "Не удалось задать уровень рассуждений",
  },
} as const satisfies DeepPartial<Translation["models"]>;

export default models;
