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

import { format, promisify, inspect } from 'util'
import { createWriteStream } from 'fs'
import { EOL } from 'os'
import pino, { LevelWithSilent, DestinationStream } from 'pino'
// Workaround - pino in browser doesn't include pino.stdTimeFunctions
// @ts-ignore
import { isoTime } from 'pino/lib/time'
import chalk from 'chalk'
import safeStringify from 'fast-safe-stringify'
import { streams, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import {
  toHexColor as namespaceToHexColor,
  Namespace,
} from './namespace'
import { BaseLoggerRepo, BaseLoggerMaker } from './logger'
import { LogLevel, toHexColor as levelToHexColor } from './level'
import { Config } from './config'
import { LogTags, formatLogTags, LOG_TAGS_COLOR, mergeLogTags, isPrimitiveType, PrimitiveType } from './log-tags'

const toPinoLogLevel = (level: LogLevel | 'none'): LevelWithSilent => (
  level === 'none' ? 'silent' : level
)

const MESSAGE_KEY = 'message'

type FormatterBaseInput = {
  level: number
  [MESSAGE_KEY]: string | Error
  time: string
  name: string
  stack?: string
  excessArgs: {
    [key: string]: unknown
  }
  type?: 'Error'
}

type FormatterInput = FormatterBaseInput & Record<string, unknown>

const formatterBaseKeys: (keyof FormatterBaseInput)[] = [
  'level', MESSAGE_KEY, 'time', 'name', 'stack', 'type', 'excessArgs',
]
const excessDefaultPinoKeys = ['hostname', 'pid']

type Formatter = (input: FormatterInput) => string

const customKeys = (
  input: FormatterInput
): string[] => Object.keys(input)
  .filter(key => !formatterBaseKeys.includes(key as keyof FormatterBaseInput))

const formatError = (input: FormatterInput): string => [
  input.stack,
  format(Object.fromEntries(customKeys(input).map(k => [k, input[k]]))),
].join(EOL)

const formatArgumentKey = (i: number): string => `arg${i}`

const formatPrimitiveExcessArg = (
  value: PrimitiveType, i: number
): Record<string, PrimitiveType> => ({
  [formatArgumentKey(i)]: value,
})

const formatExcessArgs = (excessArgs?: unknown[]): LogTags => {
  const baseExcessArgs = (excessArgs || [])
  const formattedExcessArgs = {}
  baseExcessArgs.forEach((excessArg, i) => {
    if (isPrimitiveType(excessArg)) {
      Object.assign(formattedExcessArgs, formatPrimitiveExcessArg(excessArg, i))
    } else if (typeof excessArg === 'object') {
      Object.assign(formattedExcessArgs, excessArg)
    } else {
      Object.assign(formattedExcessArgs, { [formatArgumentKey(i)]: inspect(excessArg) })
    }
  })
  return formattedExcessArgs
}

const textFormat = (
  { colorize }: { colorize: boolean }
): Formatter => input => {
  const { level: levelNumber, name, message, time: timeJson } = input
  const level = pino.levels.labels[levelNumber] as LogLevel
  const inputWithExcessArgs = { ...input,
    ...formatExcessArgs(
    input.excessArgs as unknown as unknown[]
    ) }
  const formattedLogTags = formatLogTags(
    inputWithExcessArgs,
    [...formatterBaseKeys, ...excessDefaultPinoKeys]
  )
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

type JsonLogObject = Record<string, unknown> & { excessArgs: unknown[] }

const formatJsonStringValue = (s: string): string => (
  s.match(/^.*(\n|\t|").*$/) ? safeStringify(s) : s
)

const formatJsonLog = (object: JsonLogObject): Record<string, unknown> => {
  const {
    excessArgs, ...logJson
  } = object as object & { excessArgs: unknown[]}
  const formattedExcessArgs = {}
  Object.entries(formatExcessArgs(excessArgs))
    .forEach(([key, value]) => {
      if (typeof value === 'string') {
        Object.assign(formattedExcessArgs, { [key]: formatJsonStringValue(value) })
        return
      }
      Object.assign(formattedExcessArgs, { [key]: value })
    })
  return { ...logJson, ...formattedExcessArgs }
}

export const loggerRepo = (
  { consoleStream }: {
    consoleStream: DestinationStream
  },
  config: Config,
): BaseLoggerRepo => {
  const { stream, end: endStream } = toStream(consoleStream, config)

  const colorize = config.colorize ?? (stream && streams.hasColors(stream as streams.MaybeTty))

  const rootPinoLogger = pino({
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
        if (config.format === 'json') return formatJsonLog(object as JsonLogObject)
        return object
      },
      bindings: (bindings: pino.Bindings) => _.omit(bindings, [...excessDefaultPinoKeys]),
    },
    messageKey: MESSAGE_KEY,
  }, stream)

  const tagsByNamespace = new collections.map.DefaultMap<string, LogTags>(
    () => config.globalTags
  )
  const childrenByNamespace = new collections.map.DefaultMap<string, pino.Logger>(
    (namespace: string) => rootPinoLogger.child({ name: namespace })
  )

  const loggerMaker: BaseLoggerMaker = (namespace: Namespace) => {
    const pinoLoggerWithoutTags = childrenByNamespace.get(namespace)
    return {
      log(level: LogLevel, message: string | Error, ...args: unknown[]): void {
        const namespaceTags = tagsByNamespace.get(namespace)
        const pinoLogger = pinoLoggerWithoutTags.child(
          { ...namespaceTags, ...config.globalTags }
        )
        const [formatted, unconsumedArgs] = typeof message === 'string'
          ? formatMessage(message, ...args)
          : [message, args]

        const logArgs = unconsumedArgs.length
          ? [
            // mark excessArgs for optional formatting later
            { excessArgs: unconsumedArgs },
            formatted,
          ]
          : [formatted]

        // @ts-ignore
        pinoLogger[level](...logArgs)
      },
      assignGlobalTags(logTags?: LogTags): void {
        if (!logTags) config.globalTags = {}
        else config.globalTags = mergeLogTags(config.globalTags, logTags)
      },
      assignTags(logTags?: LogTags): void {
        if (!logTags) tagsByNamespace.set(namespace, {})
        else tagsByNamespace.set(namespace, mergeLogTags(tagsByNamespace.get(namespace), logTags))
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
      childrenByNamespace.forEach(child => { child.level = pinoLevel })
    },
  })
}
