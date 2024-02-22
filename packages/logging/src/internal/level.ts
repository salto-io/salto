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
import { validateOneOf } from './common'
import { byName as colorsByName } from './colors'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export const LOG_LEVELS: ReadonlyArray<LogLevel> = Object.freeze([
  // I don't know a way to prevent duplication of LogLevel without installing some pre-processor
  // Also, these need to be in increasing order of importance
  'trace',
  'debug',
  'info',
  'warn',
  'error',
])

export const validateLogLevel = (l: string): LogLevel => validateOneOf(LOG_LEVELS, 'log level', l)

const longestLevel = Math.max(...LOG_LEVELS.map(l => l.length))
export const pad = (l: LogLevel): string => l.padEnd(longestLevel)

const levelColors: Record<LogLevel, string> = Object.freeze({
  trace: colorsByName.Blue,
  debug: colorsByName.Grey,
  info: colorsByName.Aqua,
  warn: colorsByName.Yellow,
  error: colorsByName.Red,
})

export const toHexColor = (l: LogLevel): string => levelColors[l]

const logLevelIndexes = Object.assign({}, ...LOG_LEVELS.map((l, i) => ({ [l]: i })))

export const compare = (l1: LogLevel, l2: LogLevel): number => logLevelIndexes[l2] - logLevelIndexes[l1]
