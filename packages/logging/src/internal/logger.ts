/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { collections } from '@salto-io/lowerdash'
import {
  Namespace,
  NamespaceOrModule,
  namespaceNormalizer as createNamespaceNormalizer,
} from './namespace'
import { LOG_LEVELS, LogLevel } from './level'
import { Config, mergeConfigs, NamespaceFilter, stringToNamespaceFilter } from './config'
import { LogTags } from './log-tags'

export type LogMethod = (message: string | Error, ...args: unknown[]) => void

export type BaseLogger = {
  log(level: LogLevel, ...rest: Parameters<LogMethod>): ReturnType<LogMethod>
  child(logTags: LogTags): BaseLogger
}

export type BaseLoggerMaker = (namespace: Namespace, tags? : LogTags) => BaseLogger

export type BaseLoggerRepo = BaseLoggerMaker & {
  setMinLevel(level: LogLevel): void
  end(): Promise<void>
}

// indexed type - needs a separate definition
type HasLoggerFuncs = {
  [level in LogLevel]: LogMethod
}

export type Logger = BaseLogger & HasLoggerFuncs & {
  readonly namespace: Namespace
  readonly time: <T>(inner: () => T, desc: string, ...descArgs: unknown[]) => T
}

type ResolvedConfig = Omit<Config, 'namespaceFilter'> & {
  namespaceFilter: NamespaceFilter
}

export const resolveConfig = (c: Config): ResolvedConfig => ({
  ...c,
  namespaceFilter: typeof c.namespaceFilter === 'string'
    ? stringToNamespaceFilter(c.namespaceFilter)
    : c.namespaceFilter as NamespaceFilter,
})

function timeMethod<T>(
  this: BaseLogger, inner: () => T, desc: string, ...descArgs: unknown[]
): T

function timeMethod<T>(
  this: BaseLogger, inner: () => Promise<T>, desc: string, ...descArgs: unknown[]
): Promise<T>

function timeMethod<T>(
  this: BaseLogger, inner: () => T| Promise<T>, desc: string, ...descArgs: unknown[]
): T | Promise<T> {
  const before = Date.now()
  const log = (): void => {
    this.log('debug', `${desc} took %o ms`, ...descArgs, Date.now() - before)
  }

  const result = inner()
  if (result instanceof Promise) {
    return result.finally(log)
  }
  log()
  return result
}

const addLogMethods = (logger: BaseLogger): Logger => Object.assign(
  logger,
  ...LOG_LEVELS.map(level => ({ [level]: logger.log.bind(logger, level) })),
  { time: timeMethod.bind(logger) },
)

export const logger = (
  baseLoggerRepo: BaseLoggerRepo,
  configGetter: () => ResolvedConfig,
  namespace: Namespace,
  tags?: LogTags,
): Logger => {
  const baseLogger = baseLoggerRepo(namespace, tags)
  const baseLog = baseLogger.log

  return addLogMethods(Object.assign(baseLogger, {
    namespace,
    log: (level: LogLevel, ...rest: Parameters<LogMethod>): void => {
      const { minLevel, namespaceFilter } = configGetter()
      if (minLevel === 'none' || !namespaceFilter(namespace)) {
        return
      }

      baseLog(level, ...rest)
    },
  }))
}

export type LoggerRepo = ((namespace: NamespaceOrModule) => Logger) & {
  setMinLevel(level: LogLevel): void
  readonly config: Readonly<Config>
  end(): Promise<void>
}

const namespaceNormalizer = createNamespaceNormalizer('src/internal/logger')

export const loggerRepo = (
  baseLoggerRepo: BaseLoggerRepo,
  initialConfig: Readonly<Config>,
): LoggerRepo => {
  let config = Object.freeze(resolveConfig(initialConfig))

  const configGetter = (): ResolvedConfig => config

  const loggers = new collections.map.DefaultMap<Namespace, Logger>(
    namespace => logger(baseLoggerRepo, configGetter, namespace)
  )

  const getLogger = (
    namespace: NamespaceOrModule
  ): Logger => loggers.get(namespaceNormalizer(namespace))

  const result = Object.assign(getLogger, {
    setMinLevel(level: LogLevel): void {
      baseLoggerRepo.setMinLevel(level)
      config = Object.freeze(resolveConfig(mergeConfigs(config, { minLevel: level })))
    },
    async end(): Promise<void> { await baseLoggerRepo.end() },
  })

  return Object.defineProperty(result, 'config', {
    get(): Readonly<Config> { return config },
  })
}
