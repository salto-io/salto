import { collections } from '@salto/lowerdash'
import {
  Namespace, NamespaceOrModule, Config, LOG_LEVELS,
  BaseLogger, Logger, LogLevel, LogMethod, BaseLoggerRepo, LoggerRepo,
  mergeConfigs,
} from './common'
import {
  normalizeNamespaceOrModule,
} from './namespaces'

const addLogMethods = (logger: BaseLogger): Logger => Object.assign(
  logger,
  ...LOG_LEVELS.map(level => ({ [level]: logger.log.bind(logger, level) })),
)

const createLogger = (
  baseLoggerRepo: BaseLoggerRepo,
  config: Config,
  namespace: Namespace,
): Logger => {
  const baseLogger = baseLoggerRepo(namespace)
  const baseLog = baseLogger.log

  return addLogMethods(Object.assign(baseLogger, {
    namespace,
    log: (level: LogLevel, ...rest: Parameters<LogMethod>): void => {
      if (!config.enabledForNamespace(namespace)) {
        return
      }

      baseLog(level, ...rest)
    },
  }))
}

export const loggerRepo = (
  baseLoggerRepo: BaseLoggerRepo,
  initialConfig: Readonly<Config>,
): LoggerRepo => {
  let config = Object.freeze(initialConfig)

  const loggers = new collections.map.DefaultMap<Namespace, Logger>(
    namespace => createLogger(baseLoggerRepo, config, namespace)
  )

  const getLogger = (
    namespace: NamespaceOrModule
  ): Logger => loggers.get(normalizeNamespaceOrModule(namespace))

  const result = Object.assign(getLogger, {
    configure(newConfig: Readonly<Partial<Config>>): void {
      config = Object.freeze(mergeConfigs(config, newConfig))
      baseLoggerRepo.configure(config)
    },
    end(): void { baseLoggerRepo.end() },
  })

  return Object.defineProperty(result, 'config', {
    get(): Readonly<Config> { return config },
  })
}
