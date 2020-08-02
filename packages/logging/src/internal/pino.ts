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
import { EOL } from 'os'
import pino, { LevelWithSilent, DestinationStream } from 'pino'
// Workaround - pino in browser doesn't include pino.stdTimeFunctions
// @ts-ignore
import { isoTime } from 'pino/lib/time'
import chalk from 'chalk'
import { streams, collections } from '@salto-io/lowerdash'
import {
  toHexColor as namespaceToHexColor,
  Namespace,
} from './namespace'
import { BaseLoggerRepo, BaseLoggerMaker, BaseLogger } from './logger'
import { LogLevel, toHexColor as levelToHexColor } from './level'
import { Config } from './config'
import { LogTags, formatLogTags, LOG_TAGS_COLOR } from './log-tags'

const toPinoLogLevel = (level: LogLevel | 'none'): LevelWithSilent => (
  level === 'none' ? 'silent' : level
)

const MESSAGE_KEY = 'message'
const MIX_LOG_PARAMTER_KEY = 'mix'
const EXCESS_LOG_ARGS_KEY = 'excessArgs'

type FormatterBaseInput = {
  level: number
  [MESSAGE_KEY]: string | Error
  time: string
  name: string
  stack?: string
  [MIX_LOG_PARAMTER_KEY]: unknown
  [EXCESS_LOG_ARGS_KEY]: {
    [key: string]: unknown
  }
  type?: 'Error'
}

type FormatterInput = FormatterBaseInput & Record<string, unknown>

const formatterBaseKeys: (keyof FormatterBaseInput)[] = [
  'level', MESSAGE_KEY, 'time', 'name', 'stack', 'type', EXCESS_LOG_ARGS_KEY, MIX_LOG_PARAMTER_KEY,
]

type Formatter = (input: FormatterInput) => string

const customKeys = (
  input: FormatterInput
): string[] => Object.keys(input)
  .filter(key => !formatterBaseKeys.includes(key as keyof FormatterBaseInput))

const formatError = (input: FormatterInput): string => [
  input.stack,
  format(Object.fromEntries(customKeys(input).map(k => [k, input[k]]))),
].join(EOL)

const textFormat = (
  { colorize }: { colorize: boolean }
): Formatter => input => {
  const { level: levelNumber, name, message, time: timeJson } = input
  const level = pino.levels.labels[levelNumber] as LogLevel
  const formattedLogTags = formatLogTags(input, [...formatterBaseKeys])
  return [
    JSON.parse(timeJson),
    colorize ? chalk.hex(levelToHexColor(level))(level) : level,
    colorize ? chalk.hex(namespaceToHexColor(name))(name) : name,
    colorize ? chalk.hex(LOG_TAGS_COLOR)(formattedLogTags) : formattedLogTags,
    input.stack ? formatError(input) : message,
  ].filter(x => x).join(' ') + EOL
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
  const stream = createWriteStream(filename, { encoding: 'utf8', flags: 'a' })
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

const formatJsonLog = (object: object): object => {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mix, excessArgs, ...logJson
  } = object as object & { mix: unknown; excessArgs: unknown[]}
  if (!mix) return logJson
  const formatMix = typeof mix === 'object' ? mix : { [`${MIX_LOG_PARAMTER_KEY}`]: mix }
  return { ...logJson, ...formatMix }
}

export const loggerRepo = (
  { consoleStream }: {
    consoleStream: DestinationStream
  },
  config: Config,
  baseTags?: LogTags
): BaseLoggerRepo => {
  const { stream, end: endStream } = toStream(consoleStream, config)

  const colorize = config.colorize ?? (stream && streams.hasColors(stream as streams.MaybeTty))

  const rootPinoLogger = pino({
    base: baseTags,
    timestamp: isoTime,
    level: toPinoLogLevel(config.minLevel),
    prettifier: textFormat,
    prettyPrint: config.format === 'text' ? {
      colorize,
    } : false,
    formatters: {
      level: (level: string) => ({ level: level.toLowerCase() }),
      log: (object: object) => {
        // When config is text leave the formatting for prettifier.
        if (config.format === 'json') return formatJsonLog(object)
        return object
      },
    },
    messageKey: MESSAGE_KEY,
  }, stream)

  const baseChildren = new collections.map.DefaultMap<string, pino.Logger>(
    (namespace: string) => rootPinoLogger.child({ name: namespace })
  )
  const childrenWithTags: pino.Logger[] = []

  const loggerMaker: BaseLoggerMaker = (namespace: Namespace, newLogTags?: LogTags) => {
    const pinoLoggerWithoutTags = baseChildren.get(namespace)
    const pinoLogger = pinoLoggerWithoutTags.child({ ...newLogTags })
    childrenWithTags.push(pinoLogger)
    return {
      log(level: LogLevel, message: string | Error, ...args: unknown[]): void {
        const [formatted, unconsumedArgs] = typeof message === 'string'
          ? formatMessage(message, ...args)
          : [message, args]

        const logArgs = unconsumedArgs.length
          ? [
            // mark "mix" object for optional formatting later
            { [MIX_LOG_PARAMTER_KEY]: unconsumedArgs[0] },
            formatted,
            // mark excessArgs for optional formatting later
            { [EXCESS_LOG_ARGS_KEY]: unconsumedArgs.slice(1) },
          ]
          : [formatted]

        // @ts-ignore
        pinoLogger[level](...logArgs)
      },
      child(childLogTags: LogTags): BaseLogger {
        return loggerMaker(namespace, { ...newLogTags, ...childLogTags })
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
      baseChildren.forEach(child => { child.level = pinoLevel })
      childrenWithTags.forEach(child => { child.level = pinoLevel })
    },
  })
}
