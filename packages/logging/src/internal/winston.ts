import winston from 'winston'
import * as Transport from 'winston-transport'
import chalk from 'chalk'
import * as logform from 'logform'
import { streams } from '@salto/lowerdash'
import { LOG_LEVELS, LogLevel, toHexColor as levelToHexColor } from './level'
import { Config, Format } from './config'
import { BaseLoggerMaker, BaseLoggerRepo } from './logger'
import {
  toHexColor as namespaceToHexColor,
} from './namespace'

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

const textFormat = (
  { colorize }: { colorize: boolean }
): logform.Format => winston.format.printf(info => {
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
  formatType === 'json' ? jsonFormat : textFormat({ colorize })
)

const fileTransport = (
  { filename, format: formatType, colorize }: {
    filename: string
    format: Format
    colorize: boolean | null
  }
): Transport => new winston.transports.File({
  filename,
  format: format({ colorize: !!colorize, format: formatType }),
})

const consoleTransport = (
  { stream, format: formatType, colorize }: {
    stream: NodeJS.WritableStream
    format: Format
    colorize: boolean | null
  },
): Transport => new winston.transports.Stream({
  stream,
  format: format({
    colorize: colorize === null
      ? streams.hasColors(stream as streams.MaybeTty)
      : colorize,
    format: formatType,
  }),
})

export type Dependencies = {
  consoleStream: NodeJS.WritableStream
}

const winstonLoggerOptions = (
  { consoleStream }: Dependencies,
  { filename, minLevel, format: formatType, colorize }: Config,
): winston.LoggerOptions => ({
  levels: winstonLogLevels,
  transports: filename
    ? fileTransport({ filename, format: formatType, colorize })
    : consoleTransport({ stream: consoleStream, format: formatType, colorize }),
  exitOnError: false,
  level: minLevel,
})

export const loggerRepo = (
  deps: Dependencies,
  initialConfig: Config,
): BaseLoggerRepo => {
  const winstonLogger = winston.createLogger(winstonLoggerOptions(deps, initialConfig))

  const loggerMaker: BaseLoggerMaker = namespace => ({
    log(level: LogLevel, message: string | Error, ...args: unknown[]): void {
      winstonLogger.log({
        level,
        namespace,
        message: message as unknown as string, // yuck
        splat: args,
      })
    },
  })

  return Object.assign(loggerMaker, {
    end(): void { winstonLogger.end() },
    configure(config: Config): void {
      winstonLogger.configure(winstonLoggerOptions(deps, config))
    },
  })
}
