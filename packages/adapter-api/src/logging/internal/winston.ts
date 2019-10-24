import winston from 'winston'
import * as Transport from 'winston-transport'
import chalk from 'chalk'
import * as logform from 'logform'
import { streams } from '@salto/lowerdash'
import {
  LOG_LEVELS, LogLevel, Namespace, Config, BasicLogger, Format,
} from './common'
import {
  toHexColor as namespaceToHexColor,
} from './namespaces'
import {
  toHexColor as levelToHexColor,
} from './levels'

const winstonLogLevels: winston.config.AbstractConfigSetLevels = Object.assign(
  {},
  ...LOG_LEVELS.map((l, i) => ({ [l]: LOG_LEVELS.length - i }))
)

const baseFormat = [
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.splat(),
]

const transformFunc = (transform: logform.TransformFunction): logform.Format => ({ transform })

const jsonFormat = winston.format.combine(
  transformFunc(info => {
    if (info.stack) {
      // the first line of the stack e.g, "Error: my error"
      const [message] = info.stack.split('\n', 1)
      info.message = message
    }

    delete info.splat

    return info
  }),
  winston.format.json(),
)

const textFormat = (colorize: boolean): logform.Format => winston.format.printf(info => {
  const { timestamp, namespace, level, message, stack } = info
  return [
    timestamp,
    colorize ? chalk.hex(levelToHexColor(level as LogLevel))(level) : level,
    colorize ? chalk.hex(namespaceToHexColor(namespace))(namespace) : namespace,
    stack || message,
  ].join(' ')
})

const format = (
  { colorize, format: formatType }: { colorize: boolean; format: Format }
): logform.Format => winston.format.combine(
  ...baseFormat,
  formatType === 'json' ? jsonFormat : textFormat(colorize)
)

const fileTransport = (
  { filename, format: formatType }: { filename: string; format: Format }
): Transport => new winston.transports.File({
  filename,
  format: format({ colorize: false, format: formatType }),
})

const consoleTransport = (
  { stream, format: formatType }: { stream: NodeJS.WritableStream; format: Format },
): Transport => new winston.transports.Stream({
  stream,
  format: format({
    colorize: streams.hasColors(stream as streams.MaybeTty),
    format: formatType,
  }),
})

export type Dependencies = {
  consoleStream: NodeJS.WritableStream
}

const createWinstonLoggerOptions = (
  { consoleStream }: Dependencies,
  { filename, minLevel, format: formatType }: Config,
): winston.LoggerOptions => ({
  levels: winstonLogLevels,
  transports: filename
    ? fileTransport({ filename, format: formatType })
    : consoleTransport({ stream: consoleStream, format: formatType }),
  exitOnError: false,
  level: minLevel,
})

export const createLogger = (
  deps: Dependencies,
  config: Config,
  rootNamespace: Namespace,
): BasicLogger => {
  const rootWinstonLogger = winston.createLogger(createWinstonLoggerOptions(deps, config))

  const createBasicLogger = (
    winstonLogger: winston.Logger,
    namespace: Namespace,
  ): BasicLogger => ({
    child: (childNamespace: Namespace): BasicLogger => {
      // Note: The options arg of the child method call was the obvious place to put the
      // namespace. However it doesn't work since winston overrides the value with the parent's
      // defaultMeta. The workaround is to not use defaultMeta - instead our log call pushes
      // the namespace into the "info" object.
      // The .child call is not practically needed but I hesistate having
      // all child loggers use the same winston logger instance.
      const childLogger = winstonLogger.child({})
      return createBasicLogger(childLogger, childNamespace)
    },
    end: () => winstonLogger.end.bind(winstonLogger),
    log: (level: LogLevel, message: string | Error, ...args: unknown[]): void => {
      winstonLogger.log({
        level,
        namespace,
        message: message as unknown as string, // yuck
        splat: args,
      })
    },
    configure: (newConfig: Config): void => {
      winstonLogger.configure(createWinstonLoggerOptions(deps, newConfig))
    },
  })

  return createBasicLogger(rootWinstonLogger, rootNamespace)
}
