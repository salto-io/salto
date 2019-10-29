import { validateOneOf } from './common'
import { byName as colorsByName } from './colors'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LOG_LEVELS: ReadonlyArray<LogLevel> = Object.freeze([
  // I don't know a way to prevent duplication of LogLevel without installing some pre-processor
  // Also, these need to be in increasing order of importance
  'debug', 'info', 'warn', 'error',
])

export const validateLogLevel = (
  l: string,
): LogLevel => validateOneOf(LOG_LEVELS, 'log level', l)

const longestLevel = Math.max(...LOG_LEVELS.map(l => l.length))
export const pad = (l: LogLevel): string => l.padEnd(longestLevel)

const levelColors: Record<LogLevel, string> = Object.freeze({
  debug: colorsByName.Grey,
  info: colorsByName.Aqua,
  warn: colorsByName.Yellow,
  error: colorsByName.Red,
})

export const toHexColor = (l: LogLevel): string => levelColors[l]

const logLevelIndexes = Object.assign({}, ...LOG_LEVELS.map((l, i) => ({ [l]: i })))

export const compare = (
  l1: LogLevel, l2: LogLevel
): number => logLevelIndexes[l2] - logLevelIndexes[l1]
