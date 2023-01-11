/*
*                      Copyright 2023 Salto Labs Ltd.
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
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { isoTime } from 'pino/lib/time'
import chalk from 'chalk'
import safeStringify from 'fast-safe-stringify'
import { streams, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import {
  toHexColor as namespaceToHexColor,
  Namespace,
} from './namespace'
import { BaseLoggerRepo, BaseLoggerMaker } from './logger'
import { LogLevel, toHexColor as levelToHexColor } from './level'
import { Config } from './config'
import { LogTags, formatLogTags, LOG_TAGS_COLOR, mergeLogTags, isPrimitiveType, PrimitiveType, normalizeLogTags } from './log-tags'

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
  excessArgs: unknown[]
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

const formatExcessArgs = (excessArgs?: FormatterBaseInput['excessArgs']): LogTags => {
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

const textPrettifier = (
  { colorize }: { colorize: boolean }
): Formatter => input => {
  const { level: levelNumber, name, message, time } = input
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
    time,
    colorize ? chalk.hex(levelToHexColor(level))(level) : level,
    colorize ? chalk.hex(namespaceToHexColor(name))(name) : name,
    colorize ? chalk.hex(LOG_TAGS_COLOR)(formattedLogTags) : formattedLogTags,
    input.stack ? formatError(input) : message,
  ].filter(x => x).join(' ') + EOL
}

const numberOfSpecifiers = (s: string): number => s.match(/%[^%]/g)?.length ?? 0

const formatMessage = (s: string, ...args: unknown[]): [string, unknown[]] => {
  const n = numberOfSpecifiers(s)
  const formattedMessage = format(s, ...args.slice(0, n))
  return [
    formattedMessage,
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

const formatJsonStringValue = (s: string): string => (
  s.match(/^.*(\n|\t|").*$/) ? safeStringify(s) : s
)

const formatJsonLog = (object: FormatterBaseInput): Record<string, unknown> => {
  const {
    excessArgs, ...logJson
  } = object
  const formattedExcessArgs = {}
  Object.entries(formatExcessArgs(excessArgs))
    .forEach(([key, value]) => {
      if (typeof value === 'string') {
        Object.assign(formattedExcessArgs, { [key]: formatJsonStringValue(value) })
        return
      }
      if (value instanceof Error) {
        Object.assign(formattedExcessArgs, { [key]: Object.fromEntries(
          Object.entries(Object.getOwnPropertyDescriptors(value))
            .map(([k, v]) => [k, v.value])
        ) })
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
  global.globalLogTags = mergeLogTags(global.globalLogTags || {}, config.globalTags)

  const colorize = config.colorize ?? (stream && streams.hasColors(stream as streams.MaybeTty))

  const rootPinoLogger = pino({
    timestamp: isoTime,
    level: toPinoLogLevel(config.minLevel),
    prettifier: textPrettifier,
    prettyPrint: config.format === 'text' ? {
      colorize,
    } : false,
    formatters: {
      level: (level: string) => ({ level: level.toLowerCase() }),
      log: (obj: object) => {
        // When config is text leave the formatting for prettifier.
        if (config.format === 'json') return formatJsonLog(obj as FormatterBaseInput)
        return obj
      },
      bindings: (bindings: pino.Bindings) => _.omit(bindings, [...excessDefaultPinoKeys]),
    },
    messageKey: MESSAGE_KEY,
  }, stream)

  const tagsByNamespace = new collections.map.DefaultMap<string, LogTags>(
    () => global.globalLogTags
  )
  const childrenByNamespace = new collections.map.DefaultMap<string, pino.Logger>(
    (namespace: string) => rootPinoLogger.child({ name: namespace })
  )

  const getLogMessageChunks = (message: string, chunkSize: number): string[] => {
    // Handle empty string message
    if (message.length === 0) {
      return [message]
    }
    const numberOfChunks = Math.ceil(message.length / chunkSize)
    const chunks = new Array(numberOfChunks)
    for (let i = 0, j = 0; i < numberOfChunks; i += 1, j += chunkSize) {
      chunks[i] = message.substr(j, chunkSize)
    }
    return chunks
  }

  const createLogArgs = (unconsumedArgs: unknown[], message: string | Error): unknown[] => (
    unconsumedArgs.length
      ? [
        // mark excessArgs for optional formatting later
        { excessArgs: unconsumedArgs },
        message,
      ]
      : [message]
  )

  const logMessage = (
    pinoLogger: pino.Logger,
    level: LogLevel,
    unconsumedArgs: unknown[],
    message: string | Error
  ): void => (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    pinoLogger[level](...createLogArgs(unconsumedArgs, message))
  )

  const logChunks = (
    pinoLogger: pino.Logger,
    level: LogLevel,
    unconsumedArgs: unknown[],
    chunks: string[]
  ): void => {
    if (chunks.length === 1) {
      logMessage(pinoLogger, level, unconsumedArgs, chunks[0])
      return
    }
    const logUuid = uuidv4()
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkTags = { chunkIndex: i, logId: logUuid }
      const loggerWithChunkTags = pinoLogger.child(normalizeLogTags(chunkTags))
      logMessage(loggerWithChunkTags, level, unconsumedArgs, chunks[i])
    }
  }

  const logJson = (
    pinoLogger: pino.Logger,
    level: LogLevel,
    unconsumedArgs: unknown[],
    message: string
  ): void => {
    const chunks = getLogMessageChunks(message, config.maxJsonLogChunkSize)
    logChunks(pinoLogger, level, unconsumedArgs, chunks)
  }


  const loggerMaker: BaseLoggerMaker = (namespace: Namespace) => {
    const pinoLoggerWithoutTags = childrenByNamespace.get(namespace)
    return {
      log(level: LogLevel, message: string | Error, ...args: unknown[]): void {
        const namespaceTags = tagsByNamespace.get(namespace)
        /*
         We must "normalize" logTags because there are types of tags that pino doesn't support
         for example - Functions.
         */
        const pinoLogger = pinoLoggerWithoutTags.child(
          normalizeLogTags({ ...namespaceTags, ...global.globalLogTags })
        )
        const [formattedOrError, unconsumedArgs] = typeof message === 'string'
          ? formatMessage(message, ...args)
          : [message, args]

        if (_.isError(formattedOrError) || config.format === 'text') {
          logMessage(pinoLogger, level, unconsumedArgs, formattedOrError)
        } else {
          logJson(pinoLogger, level, unconsumedArgs, formattedOrError)
        }
      },
      assignGlobalTags(logTags?: LogTags): void {
        if (!logTags) global.globalLogTags = {}
        else global.globalLogTags = mergeLogTags(global.globalLogTags, logTags)
      },
      getGlobalTags(): LogTags {
        return normalizeLogTags(global.globalLogTags)
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
