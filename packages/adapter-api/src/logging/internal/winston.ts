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
  winston.format.timestamp(),
  winston.format.splat(),
  winston.format.printf(info => {
    const { timestamp, namespace, level, message } = info
    return [
      timestamp,
      colorize ? chalk.hex(levelToHexColor(level as LogLevel))(level) : level,
      colorize ? chalk.hex(namespaceToHexColor(namespace))(namespace) : namespace,
      message,
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

const createWinstonLogger = (
  { consoleStream }: Dependencies,
  { filename, minLevel }: Config,
  namespace: Namespace,
): winston.Logger => winston.createLogger({
  levels: winstonLogLevels,
  transports: filename
    ? fileTransport(filename)
    : consoleTransport(consoleStream),
  exitOnError: false,
  defaultMeta: { namespace },
  level: minLevel,
})

export const createLogger = (
  deps: Dependencies,
  config: Config,
  rootNamespace: Namespace,
): BasicLogger => {
  const rootWinstonLogger = createWinstonLogger(deps, config, rootNamespace)

  const createBasicLogger = (winstonLogger: winston.Logger): BasicLogger => ({
    child: (namespace: Namespace): BasicLogger => createBasicLogger(
      winstonLogger.child({ namespace }),
    ),
    end: () => winstonLogger.end.bind(winstonLogger),
    log: (level: LogLevel, message: string | Error, ...args: unknown[]): void => {
      winstonLogger.log({ level, message: message as unknown as string, splat: args })
    },
  })

  return createBasicLogger(rootWinstonLogger)
}
