import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `chat` namespace. Partial — anything omitted falls back to the English
 * string, per key, via `deepMerge` in `./index.ts`.
 *
 * Note these are approval-pill reasons, which only the *user* ever sees. The block and deny
 * reasons the model reads are not here and are never translated: they are "do not retry"
 * instructions, and English is what weak and local models follow most reliably.
 */
const chat = {
  approval: {
    reason: {
      plan: {
        shellNotReadOnly:
          "Режим планирования: эта команда не только для чтения — разрешите её выполнение или отклоните, чтобы продолжить планирование.",
        mutatingOperation:
          "Режим планирования: эта операция может изменять файлы или выйти за пределы рабочей папки — разрешите её или отклоните, чтобы продолжить планирование.",
      },
      acceptEdits: {
        outsideAllowlist: "Файл для правки вне списка автоматически разрешённых путей.",
      },
      auto: {
        mcpTool:
          "Авторежим: запустить MCP-инструмент {tool}? Он работает вне рабочей папки, и проверить его безопасность невозможно — разрешите или отклоните.",
        forkBomb:
          "Авторежим: это похоже на проблему с большой рекурсивностью и потреблением ресурсов — разрешите или отклоните.",
        blockDeviceRedirect:
          "Авторежим: вывод перенаправляется на блочное устройство, что может уничтожить диск — разрешите или отклоните.",
        recursiveDelete:
          "Авторежим: рекурсивное удаление файлов или слишком длинный путь — разрешите или отклоните.",
        windowsDelete:
          "Авторежим: рекурсивное удаление или форматирование файлов — разрешите или отклоните.",
        filesystemDestroy:
          "Авторежим: потенциальная проблема с удалением файлов — разрешите или отклоните.",
        deviceWrite:
          "Авторежим: `dd` пишет в устройство или файл, что может быть повлиять на работу агента — разрешите или отклоните.",
        permissionSweep:
          "Авторежим: рекурсивная смена прав или владельца — разрешите или отклоните.",
        privilegeEscalation:
          "Авторежим: запуск с расширенным набором привилегий — разрешите или отклоните.",
        powerControl: "Авторежим: выключение или перезагрузка машины — разрешите или отклоните.",
        killAll: "Авторежим: сигнал будет отправлен всем процессам — разрешите или отклоните.",
        rawNetwork:
          "Авторежим: используется сетевое соединение, через которое возможна утечка данных — разрешите или отклоните.",
        upload: "Авторежим: данные загружаются на удалённый сервер — разрешите или отклоните.",
        remoteCopy: "Авторежим: файлы копируются на удалённый хост — разрешите или отклоните.",
        secretOverNetwork:
          "Авторежим: файл(ы) с ключи или учётными данными отправляются по сети — разрешите или отклоните.",
        pipeToShell:
          "Авторежим: загруженное содержимое передаётся в интерпретатор (удалённое выполнение кода) — разрешите или отклоните.",
        writeSecret:
          "Авторежим: запись в файл с секретами или учётными данными — разрешите или отклоните.",
        writeGitDir: "Авторежим: запись внутрь каталога `.git` — разрешите или отклоните.",
        writeOutsideProject: "Авторежим: запись по пути вне проекта — разрешите или отклоните.",
      },
    },
  },

  review: {
    fileCount: "{count} {{файлов|файл|файла|файла|файлов|файлов}}",
    // The count renders as a separate badge, so this selects on it without printing it. The verb
    // agrees with the noun's number, which is why "изменён" appears only in the `one` slot.
    filesChanged:
      "{{count:файлов изменено|файл изменён|файла изменено|файла изменено|файлов изменено|файлов изменено}}",
    turnSuffix: " · {count} {{ходов|ход|хода|хода|ходов|ходов}}",

    cta: "Посмотреть изменения →",
    title: "Обзор изменений",
    rejectAll: "Отклонить все",
    acceptAll: "Принять все",
    close: "Закрыть ревью",
    selectFile: "выберите файл",
    loadingDiff: "Загрузка диффа…",
    fileList: "Файлы",
    rejectFile: "Отклонить {path}",
    acceptFile: "Принять {path}",
  },

  ask: {
    sendChoices: "Отправить {count} {{вариантов|вариант|варианта|варианта|вариантов|вариантов}}",
    yourAnswer: "ваш ответ",
    backToOptions: "назад к вариантам",
    addMissing: "Добавить свой вариант…",
    addMissingHint: "Впишите то, чего нет в списке.",
    previewBadge: "превью",
    noPreview: "Для этого варианта нет превью.",
    eyebrow: "pi спрашивает",
    eyebrowResolved: "pi спросил",
    awaitingPick: "ждёт вашего выбора",
    pickAny: "выберите любые",
    answeredCount: "отвечено {answered}/{total}",
    answeredStatus: "отвечено",
    noAnswer: "Ответ не записан.",
    somethingElse: "Другое…",
    somethingElseDesc: "Ничего не подходит — впишите свой ответ.",
    describePlaceholder: "Опишите, что нужно…",
    composerHint: "{enter} отправить · {shiftEnter} новая строка",
    pickHint: "{from}–{to} выбрать · {enter} отправить",
    toggleHint: "{from}–{to} переключить",
    previewHint: "{up}{down} превью · {enter} выбрать",
    pickNextHint: "{from}–{to} выбрать · {enter} далее",
    sendPick: "Отправить выбор",
    sendCustom: "Отправить свой ответ",
    choose: "Выбрать «{label}»",
    sendAnswers: "Отправить ответы",
    skip: "Пропустить",
    review: "Проверить",
    reviewHint: "проверьте ответы и отправьте",
    addedByYou: "добавлено вами",
    addItem: "добавить пункт",
    addPlaceholder: "Введите значение…",
    add: "Добавить",
    remove: "Убрать",
    notAnswered: "без ответа",
    skipped: "пропущено",
    joinSeparator: ", ",
  },

  composer: {
    // `@`, `/` and `!` are the literal trigger characters typed into the composer.
    placeholder: "Напишите сообщение…  @ файлы · / команды · ! оболочка",
    ariaLabel: "Сообщение",
    send: "Отправить",
    sendAria: "Отправить сообщение",
    sendTooltip: "Отправить сообщение · Enter",
    stop: "Стоп",
    stopAria: "Остановить генерацию",
    stopTooltip: "Остановить генерацию · Esc",
    forceStop: "Остановить принудительно",
    forceStopTooltip: "Агент всё ещё работает — завершить процесс и закончить ход",
    removeAttachment: "Убрать {path}",
    previewImage: "Просмотр {name}",
    removeImage: "Убрать {name}",
  },

  approvalPill: {
    alwaysAllowTooltip: "Разрешить эту команду до конца сессии",
    alwaysAllow: "всегда разрешать {key}",
    deny: "Отклонить",
    allowOnce: "Разрешить один раз",
  },

  planCard: {
    commentsPending:
      "{count} {{комментариев|комментарий|комментария|комментария|комментариев|комментариев}} в ожидании — запросите изменения, чтобы отправить их, или утвердите план как есть.",
    header: "План",
    approvingHint:
      "Подтверждение выводит сессию из режима планирования и отправляет запрос на продолжение.",
    revise: "Доработать",
    reviseAria: "Отправить комментарии, чтобы доработать план",
    approve: "Подтвердить и выполнить",
    approveAria: "Подтвердить и выполнить план",
    targetModeAria: "Режим подтверждения: {mode}",
    targetMode: {
      ask: { label: "Спрашивать разрешение", blurb: "Подтверждать каждый изменяющий вызов." },
      acceptEdits: {
        label: "Принимать правки",
        blurb: "Автоматически принимать правки в этом проекте.",
      },
      auto: {
        label: "Авто",
        blurb: "Работать самостоятельно; рискованные действия — с подтверждением.",
      },
    },
  },

  authorYou: "вы",
  selectModel: "выбрать модель",

  tools: {
    moreLines: "⋯ ещё {count} {{строк|строка|строки|строки|строк|строк}}",
    editCount: "{count} {{правок|правка|правки|правки|правок|правок}}",
    showLess: "Свернуть",
    showFullOutput: "Показать весь вывод ({count} {{строк|строка|строки|строки|строк|строк}})",
    linesTotal: "всего {count} {{строк|строка|строки|строки|строк|строк}}",
    showAllEdits: "Показать все {count} {{правок|правку|правки|правки|правок|правок}}",
    stat: { ok: "ок", error: "ошибка" },
    errorHeading: "Ошибка",
    status: {
      // `{name}` is the tool's own name (`read`, `bash`) and is never translated.
      fallbackName: "Инструмент",
      queued: "{name} в очереди",
      running: "{name} выполняется",
      completed: "{name} завершён",
      failed: "{name} завершился с ошибкой",
      failedWith: "{name} завершился с ошибкой: {error}",
      cancelled: "{name} отменён",
    },
    section: {
      input: "Входные данные",
      result: "Результат",
      partialResult: "Частичный результат",
      tool: "Инструмент",
      args: "Аргументы",
    },
    // The chip names below echo the tool's own input field names, which stay as pi spells them.
    read: { offset: "смещение {offset}", limit: "лимит {limit}", contents: "Содержимое файла" },
    write: { contents: "Содержимое для записи" },
    bash: { output: "Вывод bash" },
    grep: {
      in: "в {path}",
      glob: "маска {glob}",
      caseInsensitive: "без учёта регистра",
      literal: "буквально",
      matches: "Совпадения grep",
    },
    find: { in: "в {path}", results: "Результаты поиска" },
    ls: { listing: "Содержимое каталога" },
  },

  header: {
    sessionTitle: "Название сессии",
  },

  modeMenu: {
    ariaLabel: "Режим агента",
    header: "Режим агента",
    ask: { label: "Спрашивать", blurb: "Подтверждать каждую запись и команду оболочки." },
    acceptEdits: {
      label: "Принимать правки",
      blurb: "Автоматически принимать правки указанных файлов и путей.",
    },
    auto: {
      label: "Авто",
      blurb: "Работать самостоятельно; рискованные действия — с подтверждением.",
    },
    plan: { label: "План", blurb: "Только планирование — без записи и команд." },
  },

  effortPicker: {
    header: "Глубина",
    ariaLabel: "Выбрать глубину рассуждений",
    adaptive: "Адаптивная",
    adaptiveTooltip: "Адаптивные рассуждения — регулируются моделью",
    adaptiveChip: "адаптивно",
    level: { low: "Низкая", medium: "Средняя", high: "Высокая" },
  },

  thinkingPicker: {
    chip: "рассуждения · {level}",
    ariaLabel: "Рассуждения: {level}",
    level: {
      off: "Выкл.",
      minimal: "Минимум",
      low: "Низкие",
      medium: "Средние",
      high: "Высокие",
      xhigh: "Очень высокие",
    },
  },

  modelMenu: {
    triggerAria: "Модель: {label}",
    selectModel: "Выбрать модель",
    thinkingSuffix: " · {level}",
    thinkingTag: "рассуждения",
    loadingModels: "Загрузка моделей…",
    needsKey: "Провайдеру нужен API-ключ.",
    noModel: "Модель не выбрана — откройте список.",
    openPicker: "Открыть выбор модели…",
  },

  modelPicker: {
    ariaLabel: "Выбрать модель",
    searchPlaceholder: "Поиск моделей…",
    empty: "Подходящих моделей нет",
    default: "по умолчанию",
    fallbackLabel: "модель",
  },

  contextUsage: {
    buttonAria: "Использование контекста: {percent}%",
    title: "Использование контекста",
    ofTokens: "Использовано {used} из {total} токенов.",
    messages: "Сообщения",
    systemPrompt: "Системный промпт",
    projectContext: "Контекст проекта",
    projectContextTitle:
      "Файлы контекста проекта (AGENTS.md, CLAUDE.md и т. п.), которые pi добавляет в системный промпт",
    tools: "Навыки и описания инструментов",
    mcp: "Инструменты MCP",
    free: "Осталось свободного места",
  },

  slashMenu: {
    ariaLabel: "Слеш-команды",
    source: { skill: "навык", prompt: "шаблон", extension: "расширение" },
  },

  imagePreview: {
    close: "Закрыть превью",
    untitled: "Изображение",
    altFallback: "Прикреплённое изображение",
    pastedName: "Вставленное изображение",
    fileFilter: "Изображения",
  },

  messageList: {
    jumpToLatest: "К последнему",
    jumpToLatestAria: "Перейти к последнему сообщению",
  },

  streaming: {
    thinking: "Думает...",
  },

  messageActions: {
    copy: "Скопировать сообщение",
    rewind: "Откатить сюда",
    fork: "Разветвить отсюда",
    streamingHint: "Недоступно во время генерации",
    noAnchor: "Нет более ранней точки для ветвления",
    confirmTitle: "Откатить сюда?",
    confirmDescription:
      "Разговор и все изменения файлов после этого сообщения будут отброшены. Незакоммиченные правки восстановить не получится.",
    confirmLabel: "Откатить",
  },

  contextMenu: {
    copyText: "Скопировать текст",
    copyMarkdown: "Скопировать как Markdown",
    commentSelection: "Прокомментировать выделенное",
    attachSelection: "Прикрепить выделенное к следующему запросу",
  },

  checkbox: {
    completed: "Выполнено",
    inProgress: "В процессе",
    notStarted: "Не начато",
  },

  planComments: {
    count: "{count} {{комментариев|комментарий|комментария|комментария|комментариев|комментариев}}",
    placeholder: "Добавьте комментарий…  Enter — добавить · Esc — отменить",
    ariaLabel: "Комментарий к выделенному тексту плана",
    edit: "Изменить комментарий",
    delete: "Удалить комментарий",
    submit: "Комментировать",
    save: "Сохранить",
  },

  errors: {
    copy: "Не удалось скопировать",
    approveTool: "Не удалось разрешить инструмент",
    denyTool: "Не удалось отклонить инструмент",
    approvePlan: "Не удалось подтвердить план",
    sendAnswer: "Не удалось отправить ваш ответ",
    filePickerUnavailable: "Выбор файлов недоступен в этой сборке",
    folderPickerUnavailable: "Выбор папок недоступен в этой сборке",
    changeAgentMode: "Не удалось сменить режим агента",
    imagePickerUnavailable: "Выбор изображений недоступен в этой сборке",
    unsupportedImageType: "Неподдерживаемый тип изображения: {type}",
    unknownType: "неизвестный",
    imageTooLarge: "Изображение слишком большое — максимум {mb} МБ",
    attachImage: "Не удалось прикрепить изображение: {message}",
    readImage: "Не удалось прочитать изображение",
    openFileDialog: "Не удалось открыть диалог выбора файла",
    decodeImage: "Не удалось декодировать изображение",
    fileReader: "Ошибка FileReader",
  },

  planSnapshot: {
    earlierSteps: "+{count} {{шагов|шаг|шага|шага|шагов|шагов}} ранее",
    moreSteps: "+{count} {{шагов|шаг|шага|шага|шагов|шагов}} далее",
    chip: "План",
    summary: "готово {done} из {total}",
  },
} as const satisfies DeepPartial<Translation["chat"]>;

export default chat;
