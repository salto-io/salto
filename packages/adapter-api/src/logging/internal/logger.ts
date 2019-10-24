import _ from 'lodash'
import {
  BasicLogger, LogLevel, LOG_LEVELS, NamespaceOrModule, Namespace, Config, mergeConfigs,
} from './common'
import {
  normalizeNamespaceOrModule,
} from './namespaces'

// indexed type - needs a separate definition
type HasLoggerFuncs = {
  [level in LogLevel]: (message: string | Error, ...args: unknown[]) => void
}

export type Logger = Omit<BasicLogger, 'child'> & HasLoggerFuncs & {
  readonly namespace: Namespace
  child: (namespaceOrModule: NamespaceOrModule) => Logger
}

export const loggerFromBasicLogger = (
  basicLogger: BasicLogger,
  initialConfig: Config,
  namespace: Namespace,
): Logger => {
  let config = initialConfig

  const result = {
    namespace,
    log: config.enabledForNamespace(namespace) ? basicLogger.log.bind(basicLogger) : _.noop,
    end: basicLogger.end.bind(basicLogger),
    child: (namespaceOrModule: NamespaceOrModule): Logger => {
      const childNamespace = normalizeNamespaceOrModule(namespace, namespaceOrModule)
      return loggerFromBasicLogger(basicLogger.child(childNamespace), config, childNamespace)
    },
    configure: (newConfig: Partial<Config>): void => {
      config = mergeConfigs(config, newConfig)
      basicLogger.configure(config)
    },
  }

  return Object.assign(
    result,
    ...LOG_LEVELS.map(level => ({ [level]: result.log.bind(result, level) })),
  )
}
