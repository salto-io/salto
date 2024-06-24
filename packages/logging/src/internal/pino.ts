/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { streams, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import { toHexColor as namespaceToHexColor, Namespace } from './namespace'
import { BaseLoggerRepo, BaseLoggerMaker } from './logger'
import { LogLevel, toHexColor as levelToHexColor } from './level'
import { Config } from './config'
import {
  LogTags,
  formatTextFormatLogTags,
  LOG_TAGS_COLOR,
  mergeLogTags,
  isPrimitiveType,
  PrimitiveType,
  normalizeLogTags,
} from './log-tags'

const toPinoLogLevel = (level: LogLevel | 'none'): LevelWithSilent => (level === 'none' ? 'silent' : level)

const MESSAGE_KEY = 'message'

type FormatterBaseInput = {
  level: number
  [MESSAGE_KEY]: string | Error
  time: string
  name: string
  stack?: string
  excessArgs: unknown[]
  logTags?: LogTags
  type?: 'Error'
}

type FormatterInput = FormatterBaseInput & Record<string, unknown>

const formatterBaseKeys: (keyof FormatterBaseInput)[] = [
  'level',
  MESSAGE_KEY,
  'time',
  'name',
  'stack',
  'type',
  'excessArgs',
]
// Removing 2 for 'stack' which in most cases isn't part of the tags and excessArgs
const COUNT_DEFAULT_TAGS = formatterBaseKeys.length - 2
const excessDefaultPinoKeys = ['hostname', 'pid']

type Formatter = (input: FormatterInput) => string

const customKeys = (input: FormatterInput): string[] =>
  Object.keys(input).filter(key => !formatterBaseKeys.includes(key as keyof FormatterBaseInput))

const formatError = (input: FormatterInput): string =>
  [input.stack, format(Object.fromEntries(customKeys(input).map(k => [k, input[k]])))].join(EOL)

const formatArgumentKey = (i: number): string => `arg${i}`

const formatPrimitiveExcessArg = (value: PrimitiveType, i: number): Record<string, PrimitiveType> => ({
  [formatArgumentKey(i)]: value,
})

const formatExcessTagsPerMessage = (maxTagsPerLogMessage: number, logTags?: LogTags, excessArgs?: LogTags): LogTags => {
  // We slice first the excess args and then the logTags
  const entriesObject = Object.entries(excessArgs ?? {}).concat(Object.entries(logTags ?? {}))
  const countCurrentTags = entriesObject.length + COUNT_DEFAULT_TAGS
  const countRemovedTags = countCurrentTags - maxTagsPerLogMessage
  if (countCurrentTags > maxTagsPerLogMessage) {
    return {
      ...Object.fromEntries(entriesObject.slice(countRemovedTags)),
      countRemovedTags,
    }
  }
  return { ...logTags, ...excessArgs }
}

const formatExcessArgs = (excessArgs?: unknown[]): LogTags => {
  const baseExcessArgs = excessArgs || []
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

const textPrettifier =
  ({ colorize }: { colorize: boolean }): Formatter =>
  input => {
    const { level: levelNumber, name, message, time } = input
    const level = pino.levels.labels[levelNumber] as LogLevel
    const formattedLogTags = formatTextFormatLogTags(input, [...formatterBaseKeys, ...excessDefaultPinoKeys])
    return (
      [
        time,
        colorize ? chalk.hex(levelToHexColor(level))(level) : level,
        colorize ? chalk.hex(namespaceToHexColor(name))(name) : name,
        colorize ? chalk.hex(LOG_TAGS_COLOR)(formattedLogTags) : formattedLogTags,
        input.stack ? formatError(input) : message,
      ]
        .filter(x => x)
        .join(' ') + EOL
    )
  }

const numberOfSpecifiers = (s: string): number => s.match(/%[^%]/g)?.length ?? 0

const formatMessage = (s: string, ...args: unknown[]): [string, unknown[]] => {
  const n = numberOfSpecifiers(s)
  const formattedMessage = format(s, ...args.slice(0, n))
  return [formattedMessage, args.slice(n)]
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

const consoleToStream = (consoleStream: DestinationStream): CreateStreamResponse => ({
  stream: consoleStream,
  end: () => Promise.resolve(),
})

const toStream = (consoleStream: DestinationStream, { filename }: { filename: string | null }): CreateStreamResponse =>
  filename ? filenameToStream(filename) : consoleToStream(consoleStream)

const formatTags = (config: Config, excessArgs: unknown[], logTags: LogTags): LogTags => {
  const formattedExcessArgs: LogTags = {}
  Object.entries(formatExcessArgs(excessArgs)).forEach(([key, value]) => {
    if (typeof value === 'string') {
      Object.assign(formattedExcessArgs, { [key]: value })
      return
    }
    if (value instanceof Error) {
      Object.assign(formattedExcessArgs, {
        [key]: Object.fromEntries(
          Object.entries(Object.getOwnPropertyDescriptors(value)).map(([k, v]) => [k, v.value]),
        ),
      })
      return
    }
    Object.assign(formattedExcessArgs, { [key]: value })
  })
  return formatExcessTagsPerMessage(config.maxTagsPerLogMessage, logTags, formattedExcessArgs)
}

export const loggerRepo = (
  {
    consoleStream,
  }: {
    consoleStream: DestinationStream
  },
  config: Config,
): BaseLoggerRepo => {
  const { stream, end: endStream } = toStream(consoleStream, config)
  const levelCountRecord: Record<LogLevel, number> = {
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
    trace: 0,
  }
  global.globalLogTags = mergeLogTags(global.globalLogTags || {}, config.globalTags)
  const tagsByNamespace = new collections.map.DefaultMap<string, LogTags>(() => global.globalLogTags)

  const colorize = config.colorize ?? (stream && streams.hasColors(stream as streams.MaybeTty))

  const rootPinoLogger = pino(
    {
      timestamp: isoTime,
      level: toPinoLogLevel(config.minLevel),
      prettifier: textPrettifier,
      prettyPrint:
        config.format === 'text'
          ? {
              colorize,
            }
          : false,
      formatters: {
        level: (level: string) => ({ level: level.toLowerCase() }),
        bindings: (bindings: pino.Bindings) => _.omit(bindings, [...excessDefaultPinoKeys]),
      },
      messageKey: MESSAGE_KEY,
    },
    stream,
  )

  const childrenByNamespace = new collections.map.DefaultMap<string, pino.Logger>((namespace: string) =>
    rootPinoLogger.child({ name: namespace }),
  )

  const getLogMessageChunks = (message: string | Error, chunkSize: number): (string | Error)[] => {
    if (message instanceof Error) {
      return [message]
    }
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

  const logConciseMessage = (pinoLogger: pino.Logger, level: LogLevel, message: string | Error): void =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    pinoLogger[level](message)

  const logChunks = (
    pinoLogger: pino.Logger,
    level: LogLevel,
    unconsumedArgs: unknown[],
    logTags: LogTags,
    chunks: (string | Error)[],
  ): void => {
    const formattedTags = formatTags(config, unconsumedArgs, logTags)
    const pinoLoggerWithFormattedTags = pinoLogger.child(formattedTags)
    if (chunks.length === 1) {
      logConciseMessage(pinoLoggerWithFormattedTags, level, chunks[0])
      return
    }
    const logUuid = uuidv4()
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkTags = { chunkIndex: i, logId: logUuid }
      const loggerWithChunkTags = pinoLoggerWithFormattedTags.child(normalizeLogTags(chunkTags))
      logConciseMessage(loggerWithChunkTags, level, chunks[i])
    }
  }

  const logMessage = (
    pinoLogger: pino.Logger,
    level: LogLevel,
    unconsumedArgs: unknown[],
    logTags: LogTags,
    message: string | Error,
  ): void => {
    const chunks = getLogMessageChunks(message, config.maxJsonLogChunkSize)
    logChunks(pinoLogger, level, unconsumedArgs, logTags, chunks)
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
        const normalizedLogTags = normalizeLogTags({ ...namespaceTags, ...global.globalLogTags })
        const [formattedOrError, unconsumedArgs] =
          typeof message === 'string' ? formatMessage(message, ...args) : [message, args]

        levelCountRecord[level] += 1

        logMessage(pinoLoggerWithoutTags, level, unconsumedArgs, normalizedLogTags, formattedOrError)
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
      getLogCount() {
        return levelCountRecord
      },
      resetLogCount() {
        Object.keys(levelCountRecord).forEach(level => {
          levelCountRecord[level as LogLevel] = 0
        })
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
      childrenByNamespace.forEach(child => {
        child.level = pinoLevel
      })
    },
  })
}
