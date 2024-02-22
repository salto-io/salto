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

import _ from 'lodash'
import safeStringify from 'fast-safe-stringify'
import { byName as colorsByName } from './colors'

export type PrimitiveType = string | number | boolean
type LogTagValue = PrimitiveType | undefined | Record<string, unknown> | Array<PrimitiveType>
export type LogTags = Record<string, LogTagValue | (() => LogTagValue)>

export const LOG_TAGS_COLOR = colorsByName.Olive

export const isPrimitiveType = (value: unknown): value is string | number | boolean =>
  ['string', 'number', 'boolean'].includes(typeof value)

export const formatPrimitiveLogTagValue = (value: unknown): string => {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString()
  }
  if (typeof value === 'string') {
    return safeStringify(value)
  }
  return ''
}

export const isErrorType = (value: unknown): value is Error => value instanceof Error

const formatKeyValue = (key: string, value: string): string => `${key}=${value}`

const formatObjectLogTag = (obj: Record<string, unknown>): string =>
  Object.entries(obj)
    .map(([key, value]) => formatKeyValue(key, typeof value === 'string' ? value : safeStringify(value)))
    .join(' ')

export const formatTextFormatLogTags = (logTags: Record<string, unknown>, baseKeys: string[]): string => {
  const tagsWithoutBaseKeys = _.omit(logTags, ...baseKeys)
  return Object.entries(tagsWithoutBaseKeys)
    .map(([logTagKey, logTagValue]) => {
      if (isPrimitiveType(logTagValue)) {
        return formatKeyValue(logTagKey, formatPrimitiveLogTagValue(logTagValue))
      }
      if (isErrorType(logTagValue)) {
        return formatObjectLogTag({ error: logTagValue, stack: logTagValue.stack, message: logTagValue.message })
      }
      if (typeof logTagValue === 'object') {
        return formatObjectLogTag({ [logTagKey]: logTagValue })
      }
      return ''
    })
    .filter(x => x)
    .join(' ')
}

export const normalizeLogTags = (logTags: LogTags): LogTags =>
  Object.fromEntries(
    Object.entries(logTags).map(([key, value]) => [key, typeof value === 'function' ? value() : value]),
  )

export const toTags = (s: string): LogTags => JSON.parse(s)

export const mergeLogTags = (currentTags: LogTags, newTags: LogTags): LogTags => {
  const mergedTags = { ...currentTags, ...newTags }
  return Object.fromEntries(Object.entries(mergedTags).filter(([, v]) => v !== undefined))
}
