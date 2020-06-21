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

import { format, promisify } from 'util'
import { createWriteStream } from 'fs'
import pino, { LevelWithSilent, DestinationStream } from 'pino'
import chalk from 'chalk'
import { streams, collections } from '@salto-io/lowerdash'
import {
  toHexColor as namespaceToHexColor,
  Namespace,
} from './namespace'
import { BaseLoggerRepo, BaseLoggerMaker } from './logger'
import { LogLevel, toHexColor as levelToHexColor } from './level'
import { Config } from './config'

const toPinoLogLevel = (level: LogLevel | 'none'): LevelWithSilent => (
  level === 'none' ? 'silent' : level
)

type FormatterBaseInput = {
  level: number
  message: string | Error
  time: string
  name: string
  stack?: string
  type?: 'Error'
}

type FormatterInput = FormatterBaseInput & Record<string, unknown>

const formatterBaseKeys: (keyof FormatterBaseInput)[] = [
  'level', 'message', 'time', 'name', 'stack', 'type',
]

type Formatter = (input: FormatterInput) => string

const customKeys = (
  input: FormatterInput
): string[] => Object.keys(input)
  .filter(key => !formatterBaseKeys.includes(key as keyof FormatterBaseInput))

const formatError = (input: FormatterInput): string => [
  input.stack,
  format(Object.fromEntries(customKeys(input).map(k => [k, input[k]]))),
].join('\n')

const textFormat = (
  { colorize }: { colorize: boolean }
): Formatter => input => {
  const { level: levelNumber, name, message, time: timeJson } = input
  const level = pino.levels.labels[levelNumber] as LogLevel

  return [
    JSON.parse(timeJson),
    colorize ? chalk.hex(levelToHexColor(level))(level) : level,
    colorize ? chalk.hex(namespaceToHexColor(name))(name) : name,
    input.stack ? formatError(input) : message,
  ].join(' ')
}

const numberOfSpecifiers = (s: string): number => s.match(/%[^%]/g)?.length ?? 0

const formatMessage = (s: string, ...args: unknown[]): [string, unknown[]] => {
  const n = numberOfSpecifiers(s)
  return [
    format(s, ...args.slice(0, n)),
    args.slice(n),
  ]
}

type CreateStreamResponse = {
  stream: DestinationStream
  end: () => Promise<void>
}

const filenameToStream = (filename: string): CreateStreamResponse => {
  const stream = createWriteStream(filename, { encoding: 'utf8' })
  return {
    stream,
    end: promisify(stream.end.bind(stream)),
  }
}

const consoleToStream = (
  consoleStream: DestinationStream
): CreateStreamResponse => ({ stream: consoleStream, end: () => Promise.resolve() })

const toStream = (
  consoleStream: DestinationStream,
  { filename }: { filename: string | null },
): CreateStreamResponse => (
  filename
    ? filenameToStream(filename)
    : consoleToStream(consoleStream)
)

export const loggerRepo = (
  { consoleStream }: {
    consoleStream: DestinationStream
  },
  config: Config
): BaseLoggerRepo => {
  const { stream, end: endStream } = toStream(consoleStream, config)

  const colorize = config.colorize ?? streams.hasColors(stream as streams.MaybeTty)

  const rootPinoLogger = pino({
    base: null,
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    level: toPinoLogLevel(config.minLevel),
    prettifier: textFormat,
    prettyPrint: config.format === 'text' ? {
      colorize,
    } : false,
    formatters: {
      level: (level: string) => ({ level: level.toLowerCase() }),
    },
  }, stream)

  const children = new collections.map.DefaultMap<string, pino.Logger>(
    (namespace: string) => rootPinoLogger.child({ name: namespace })
  )

  const loggerMaker: BaseLoggerMaker = (namespace: Namespace) => {
    const pinoLogger = children.get(namespace)
    return {
      log(level: LogLevel, message: string | Error, ...args: unknown[]): void {
        const [formatted, unconsumedArgs] = typeof message === 'string'
          ? formatMessage(message, ...args)
          : [message, args]

        const logArgs = unconsumedArgs.length
          ? [unconsumedArgs[0], formatted, ...unconsumedArgs.slice(1)] // "mix" object
          : [formatted]

        // @ts-ignore
        pinoLogger[level](...logArgs)
      },
    }
  }

  return Object.assign(loggerMaker, {
    async end(): Promise<void> {
      rootPinoLogger.flush()
      return endStream()
    },

    setMinLevel(level: LogLevel): void {
      const pinoLevel = toPinoLogLevel(level)
      rootPinoLogger.level = pinoLevel
      children.forEach(child => { child.level = pinoLevel })
    },
  })
}
