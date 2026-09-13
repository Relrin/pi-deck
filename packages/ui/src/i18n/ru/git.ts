import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `git` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * Git's own vocabulary survives translation verbatim: the shell commands inside `notify.*.reason`,
 * the `pull --rebase` action label, `--force-with-lease`, `HEAD`, and remote and branch names
 * interpolated as `{remote}` / `{branch}`. Everything wrapped *around* them is translated.
 *
 * The `reason.*` slugs are read by a person and matched by nothing, so they take the Russian term.
 */
const git = {
  notify: {
    // `{remote}`/`{branch}` are git refs; only the separator is ours.
    remoteBranchMeta: "{remote}/{branch} · {reason}",
    viewLog: "открыть лог",

    commit: {
      tag: "Коммит",
      title: "Закоммичено в {branch}",
      titleNoBranch: "Коммит создан",
      meta: "{sha} · {count} {{файлов|файл|файла|файла|файлов|файлов}} · +{add} -{del} · {when}",
      failedTitle: "Не удалось закоммитить",
    },

    push: {
      tag: "Пуш",
      tagRejected: "Пуш отклонён",
      tagFailed: "Пуш не прошёл",
      title: "Запушено в {remote}/{branch}",
      sentUpstream: "Отправлено {count} {{коммитов|коммит|коммита|коммита|коммитов|коммитов}}.",
      upToDate: "Ветка уже синхронизирована с origin.",
      failedTitle: "Не удалось запушить в {remote}",
      reason: {
        nonFastForward:
          "На удалённом сервере есть коммиты, которых нет локально. Fast-forward невозможен.",
        noUpstream:
          "Upstream-ветка не настроена. Сначала задайте её: `git push -u <remote> <branch>`.",
        authFailed:
          "Ошибка аутентификации. Проверьте учётные данные или SSH-ключ для этого remote.",
        rejected: "Удалённый сервер отклонил пуш (вероятно, из-за pre-receive-хука).",
        unknown: "Пуш не прошёл. Подробности — в логе.",
      },
    },

    pull: {
      tag: "Пул",
      tagFailed: "Пул не прошёл",
      title: "Получено из {remote}/{branch}",
      rebased: "Локальные коммиты перебазированы сверху.",
      fastForwarded: "Локальная ветка перемотана вперёд.",
      failedTitle: "Не удалось получить из {remote}",
      reason: {
        conflict:
          "Конфликт слияния — разрешите его в редакторе и закоммитьте, чтобы завершить пул.",
        noUpstream:
          "Нет отслеживаемой ветки. Задайте её: `git branch --set-upstream-to=<remote>/<branch>`.",
        authFailed: "Ошибка аутентификации. Проверьте учётные данные или SSH-ключ.",
        unknown: "Пул не прошёл. Подробности — в логе.",
      },
    },

    rollback: {
      tag: "Сбросить",
      title: "Файлы сбросить",
      body: "Восстановлено к HEAD: {count} {{файлов|файл|файла|файла|файлов|файлов}}.",
      failedTitle: "Не удалось сбросить",
    },

    stash: {
      tag: "Стеш",
      title: "Изменения застешены",
      bodySelected: "В стеш перенесено {count} {{файлов|файл|файла|файла|файлов|файлов}}.",
      bodyAll: "Рабочее дерево застешено.",
      failedTitle: "Не удалось застешить",
      reason: {
        noChanges: "Стешить нечего — рабочее дерево совпадает с HEAD.",
        unknown: "Не удалось застешить. Подробности — в логе.",
      },
    },

    stashPop: {
      tag: "Применение",
      title: "Стеш применён",
      body: "Последняя запись стеша восстановлена и удалена.",
      failedTitle: "Не удалось применить стеш",
      reason: {
        emptyStack: "В стеше нет записей.",
        conflict: "Конфликт при применении стеша — разрешите его в редакторе и закоммитьте.",
        unknown: "Не удалось применить стеш. Подробности — в логе.",
      },
    },

    refresh: {
      title: "Состояние git обновлено",
      body: "Рабочее дерево, ветки и последние коммиты перечитаны с диска.",
    },
  },

  reason: {
    nonFastForward: "не-fast-forward",
    noUpstream: "нет-upstream",
    authFailed: "ошибка-входа",
    rejected: "отклонено",
    unknown: "неизвестно",
    conflict: "конфликт",
  },

  // `git log` names the command whose raw output the window shows.
  logWindowTitle: "git log",

  actions: {
    view: "открыть",
    undo: "отменить",
    push: "запушить",
    apply: "применить",
    forcePush: "форс-пуш",
    // The literal git command the user would type. Never translated.
    pullRebase: "pull --rebase",
  },

  errors: {
    loadBranches: "Не удалось загрузить ветки",
    checkoutBranch: "Не удалось переключить ветку",
    createBranch: "Не удалось создать ветку",
    readStatus: "Не удалось прочитать состояние git",
    initRepo: "Не удалось инициализировать репозиторий",
    openPrUrl: "Не удалось открыть ссылку на PR",
    undo: "Не удалось отменить",
    resolveCommitUrl: "Не удалось получить ссылку на коммит",
    copy: "Не удалось скопировать",
  },

  store: {
    noFilesSelected: "Файлы не выбраны.",
    copiedToClipboard: "Скопировано в буфер обмена: «{name}»",
  },

  sidebar: {
    noSession: "Начните или откройте сессию, чтобы увидеть состояние git.",
    loading: "Чтение git…",
    noData: "Нет данных git.",
  },

  empty: {
    title: "Не git-репозиторий",
    blurb:
      "Этот проект не отслеживается git. Инициализируйте репозиторий, чтобы включить список изменений, историю коммитов и отслеживание файлов, которых касался агент.",
    init: "Инициализировать репозиторий",
  },

  branch: {
    sectionLabel: "ветка",
    noRemote: "remote не настроен",
    pull: "запулить",
    push: "запушить",
    openPr: "открыть pr",
    disabledTooltip: "{label} — {reason}",
    disabledLabel: "{label} ({reason})",
  },

  picker: {
    select: "Выбрать ветку",
    copyName: "Скопировать имя ветки",
    current: "Текущая",
    recent: "Недавние",
    merged: "влита",
    searchPlaceholder: "перейти к ветке…",
    searchLabel: "Поиск по веткам",
    newBranchPlaceholder: "новая ветка от {branch}",
    newBranchLabel: "Создать новую ветку от {branch}",
    loadFailed: "Не удалось загрузить ветки: {error}",
    loading: "Загрузка веток…",
    none: "Веток нет.",
    noneYet: "Веток пока нет.",
    noMatches: "Нет веток по запросу «{query}».",
  },

  changes: {
    sectionLabel: "изменения",
    stageAll: "выбрать все",
    stageAllTitle: "Выбрать все файлы для следующего коммита",
    clean: "рабочее дерево чисто",
    toggleHunk: "Переключить фрагмент {index} из {total}",
    hunkMeta: "фрагмент {index}/{total} · {range}",
    group: {
      added: "добавлено",
      modified: "изменено",
      deleted: "удалено",
      untracked: "не отслеживается",
    },
  },

  row: {
    touched: "{path} · изменён текущей сессией",
    stage: "Выбрать {path}",
    openInEditor: "Открыть файл в редакторе",
    rollback: "Откатить",
  },

  toolbar: {
    label: "Действия с рабочим деревом",
    refresh: "обновить",
    refreshTitle: "Перечитать состояние git с диска",
    rollback: "откатить",
    rollbackTitle: "Откатить выбранные файлы к HEAD",
    rollbackTitleEmpty: "Выберите файлы для отката",
    stash: "стеш",
    stashTitleSelected: "Застешить выбранные изменения",
    stashTitleAll: "Застешить все изменения рабочего дерева",
    apply: "применить",
    applyTitle: "Применить и удалить последнюю запись стеша",
  },

  composer: {
    sectionLabel: "коммит",
    placeholder: "опишите изменение…",
    amend: "дополнить предыдущий коммит",
    forcePush: "форс-пуш",
    forceWithLeaseFlag: "--force-with-lease",
    submit: "Закоммитить",
    submitDisabled: "Введите сообщение коммита",
    submitPush: "Закоммитить и запушить",
    commit: "коммит",
    commitPush: "коммит и пуш",
  },

  groupMenu: {
    label: "Группировать изменения по",
    header: "Группировать изменения по",
    trigger: "группировка: {value}",
    option: {
      file: { label: "Файл", description: "одна строка на файл (по умолчанию)", value: "файл" },
      hunk: { label: "Фрагмент", description: "разбить файл на фрагменты", value: "фрагмент" },
      change: {
        label: "Тип изменения",
        description: "добавлено · изменено · удалено",
        value: "тип изменения",
      },
      folder: { label: "Папка", description: "по родительскому каталогу", value: "папка" },
    },
  },
} as const satisfies DeepPartial<Translation["git"]>;

export default git;
