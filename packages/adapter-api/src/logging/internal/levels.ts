import { LogLevel, LOG_LEVELS } from './common'
import { byName as colorsByName } from './colors'

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
