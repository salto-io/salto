/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { format } from 'util'
import { collections } from '@salto-io/lowerdash'
import {
  Namespace,
  NamespaceOrModule,
  namespaceNormalizer as createNamespaceNormalizer,
  NamespaceFragment,
} from './namespace'
import { LOG_LEVELS, LogLevel } from './level'
import { Config, mergeConfigs, NamespaceFilter, stringToNamespaceFilter } from './config'
import { LogTags } from './log-tags'
import { LogTimeDecorator } from './log-time-decorator'

export type LogMethod = (message: string | Error, ...args: unknown[]) => void

export type BaseLogger = {
  log(level: LogLevel, ...rest: Parameters<LogMethod>): ReturnType<LogMethod>
  assignTags(logTags?: LogTags): void
  getLogCount(): Record<LogLevel, number>
  resetLogCount(): void
}

export type GlobalTags = {
  assignGlobalTags(logTags?: LogTags): void
  getGlobalTags(): LogTags
}

export type BaseLoggerMaker = (namespace: Namespace, tags?: LogTags) => BaseLogger & GlobalTags

export type BaseLoggerRepo = BaseLoggerMaker & {
  setMinLevel(level: LogLevel): void
  end(): Promise<void>
}

// indexed type - needs a separate definition
type HasLoggerFuncs = {
  [level in LogLevel]: LogMethod
}

export type Logger = BaseLogger &
  GlobalTags &
  HasLoggerFuncs & {
    readonly namespace: Namespace
    readonly time: <T>(inner: () => T, desc: string, ...descArgs: unknown[]) => T
    readonly timeDebug: <T>(inner: () => T, desc: string, ...descArgs: unknown[]) => T
    readonly timeTrace: <T>(inner: () => T, desc: string, ...descArgs: unknown[]) => T
    readonly timeIteratorDebug: <T>(iterable: Iterable<T>, desc: string, ...descArgs: unknown[]) => Iterable<T>
    readonly timeIteratorTrace: <T>(iterable: Iterable<T>, desc: string, ...descArgs: unknown[]) => Iterable<T>
    assignGlobalLogTimeDecorator: <T>(decorator: LogTimeDecorator<T>) => void
  }

type ResolvedConfig = Omit<Config, 'namespaceFilter'> & {
  namespaceFilter: NamespaceFilter
}

export const resolveConfig = (c: Config): ResolvedConfig => ({
  ...c,
  namespaceFilter:
    typeof c.namespaceFilter === 'string' ? stringToNamespaceFilter(c.namespaceFilter) : c.namespaceFilter,
})

function timeMethod<T>(
  this: BaseLogger,
  level: LogLevel,
  inner: () => T | Promise<T>,
  desc: string,
  ...descArgs: unknown[]
): T | Promise<T> {
  const before = Date.now()
  const formattedDescription = format(desc, ...descArgs)
  const logDuration = (): void => {
    this.log(level, `${formattedDescription} took %o ms`, Date.now() - before)
  }

  this.log(level, `${formattedDescription} starting`)
  let result: T | Promise<T>
  if (global.globalLogTimeDecorator) {
    result = global.globalLogTimeDecorator(inner, formattedDescription)()
  } else {
    result = inner()
  }
  if (result instanceof Promise) {
    return result.finally(logDuration)
  }
  logDuration()
  return result
}

function timeIterator<T>(
  this: BaseLogger,
  level: LogLevel,
  iterable: Iterable<T>,
  desc: string,
  ...descArgs: unknown[]
): Iterable<T> {
  const createTime = Date.now()
  let startTime: number | undefined
  let netTimeTaken = 0

  const formattedDescription = format(desc, ...descArgs)

  this.log(level, '%s starting', formattedDescription)

  return {
    [Symbol.iterator]: () => {
      const iter = iterable[Symbol.iterator]()

      return {
        ...iter,
        next: () => {
          const callStartTime = Date.now()
          if (startTime === undefined) {
            startTime = callStartTime
          }
          const res = iter.next()
          const endTime = Date.now()
          netTimeTaken += endTime - callStartTime
          if (res.done) {
            this.log(
              level,
              '%s took %o ms (tts=%o ms net=%o ms)',
              formattedDescription,
              endTime - createTime,
              startTime - createTime,
              netTimeTaken,
            )
          }
          return res
        },
      }
    },
  }
}

const addLogMethods = (logger: BaseLogger): Logger =>
  Object.assign(logger, ...LOG_LEVELS.map(level => ({ [level]: logger.log.bind(logger, level) })), {
    time: timeMethod.bind(logger, 'debug'),
    timeDebug: timeMethod.bind(logger, 'debug'),
    timeTrace: timeMethod.bind(logger, 'trace'),
    timeIteratorDebug: timeIterator.bind(logger, 'debug'),
    timeIteratorTrace: timeIterator.bind(logger, 'trace'),
  })

export const logger = (
  baseLoggerRepo: BaseLoggerRepo,
  configGetter: () => ResolvedConfig,
  namespace: Namespace,
  tags?: LogTags,
): Logger => {
  const baseLogger = baseLoggerRepo(namespace, tags)
  const baseLogCount = baseLogger.getLogCount
  const baseResetLogCount = baseLogger.resetLogCount
  const baseLog = baseLogger.log

  return addLogMethods(
    Object.assign(baseLogger, {
      namespace,
      assignGlobalLogTimeDecorator: <T>(decorator: LogTimeDecorator<T>) => {
        global.globalLogTimeDecorator = decorator
      },
      log: (level: LogLevel, ...rest: Parameters<LogMethod>): void => {
        const { minLevel, namespaceFilter } = configGetter()
        if (minLevel === 'none' || !namespaceFilter(namespace)) {
          return
        }

        baseLog(level, ...rest)
      },
      getLogCount: () => baseLogCount(),
      resetLogCount: (): void => baseResetLogCount(),
    }),
  )
}

export type LoggerRepo = ((namespace: NamespaceOrModule, ...namespaceFragments: NamespaceFragment[]) => Logger) & {
  setMinLevel(level: LogLevel): void
  readonly config: Readonly<Config>
  end(): Promise<void>
}

const namespaceNormalizer = createNamespaceNormalizer('src/internal/logger')

export const loggerRepo = (baseLoggerRepo: BaseLoggerRepo, initialConfig: Readonly<Config>): LoggerRepo => {
  let config = Object.freeze(resolveConfig(initialConfig))

  const configGetter = (): ResolvedConfig => config

  const loggers = new collections.map.DefaultMap<Namespace, Logger>(namespace =>
    logger(baseLoggerRepo, configGetter, namespace),
  )

  const getLogger = (namespace: NamespaceOrModule, ...namespaceFragments: NamespaceFragment[]): Logger =>
    loggers.get(namespaceNormalizer(namespace, namespaceFragments))

  const result = Object.assign(getLogger, {
    setMinLevel(level: LogLevel): void {
      baseLoggerRepo.setMinLevel(level)
      config = Object.freeze(resolveConfig(mergeConfigs(config, { minLevel: level })))
    },
    async end(): Promise<void> {
      await baseLoggerRepo.end()
    },
  })

  return Object.defineProperty(result, 'config', {
    get(): Readonly<Config> {
      return config
    },
  }) as LoggerRepo
}
