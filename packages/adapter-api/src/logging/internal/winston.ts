import winston from 'winston'
import * as Transport from 'winston-transport'
import chalk from 'chalk'
import { Format } from 'logform'
import { streams } from '@salto/lowerdash'
import {
  LOG_LEVELS, LogLevel, Namespace, Config, BasicLogger,
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

const format = (colorize: boolean): Format => winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.splat(),
  winston.format.printf(info => {
    const { timestamp, namespace, level, message, stack } = info
    return [
      timestamp,
      colorize ? chalk.hex(levelToHexColor(level as LogLevel))(level) : level,
      colorize ? chalk.hex(namespaceToHexColor(namespace))(namespace) : namespace,
      stack || message,
    ].join(' ')
  }),
)

const fileTransport = (filename: string): Transport => new winston.transports.File({
  filename,
  format: format(false),
})

const consoleTransport = (
  stream: NodeJS.WritableStream
): Transport => new winston.transports.Stream({
  stream,
  format: format(streams.hasColors(stream as streams.MaybeTty)),
})

export type Dependencies = {
  consoleStream: NodeJS.WritableStream
}

const createWinstonLoggerOptions = (
  { consoleStream }: Dependencies,
  { filename, minLevel }: Config,
): winston.LoggerOptions => ({
  levels: winstonLogLevels,
  transports: filename
    ? fileTransport(filename)
    : consoleTransport(consoleStream),
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
