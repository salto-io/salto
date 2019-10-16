import _ from 'lodash'
import {
  BasicLogger, LogLevel, LOG_LEVELS, NamespaceOrModule, Namespace, Config,
} from './common'
import {
  normalizeNamespaceOrModule,
} from './namespaces'

// indexed type - needs a separate definition
type HasLoggerFuncs = {
  [level in LogLevel]: (message: string | Error, ...args: unknown[]) => void
}

export type Logger = BasicLogger & HasLoggerFuncs & {
  child: (namespaceOrModule: NamespaceOrModule) => Logger
  readonly namespace: Namespace
}

export const loggerFromBasicLogger = (
  basicLogger: BasicLogger,
  config: Config,
  namespace: Namespace,
): Logger => {
  const result = {
    namespace,
    log: config.enabledForNamespace(namespace) ? basicLogger.log.bind(basicLogger) : _.noop,
    end: basicLogger.end.bind(basicLogger),
    child: (namespaceOrModule: NamespaceOrModule): Logger => {
      const childNamespace = normalizeNamespaceOrModule(namespace, namespaceOrModule)
      return loggerFromBasicLogger(basicLogger.child(childNamespace), config, childNamespace)
    },
  }

  return Object.assign(
    result,
    ...LOG_LEVELS.map(level => ({ [level]: result.log.bind(result, level) })),
  )
}
