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

import _ from 'lodash'
import safeStringify from 'fast-safe-stringify'
import { byName as colorsByName } from './colors'

export type PrimitiveType = string | number | boolean
export type LogTags = Record<string, PrimitiveType | undefined | Record<string, unknown>>

export const LOG_TAGS_COLOR = colorsByName.Olive

export const stringifyIfNecessary = (s: string): string => {
  try { // If string is already stringified, don't stringify again
    JSON.parse(s)
    return s
  } catch (e) {
    return s.match(/^.*(\n|\t|").*$/) ? safeStringify(s) : s
  }
}

const encapsulateIfNecessary = (s: string): string => (s.match(/^".*"$/) ? s : `"${s}"`)

export const isPrimitiveType = (value: unknown): value is string | number | boolean =>
  ['string', 'number', 'boolean'].includes(typeof value)

export const formatPrimitiveLogTagValue = (value: unknown): string => {
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString()
  if (typeof value === 'string') return encapsulateIfNecessary(stringifyIfNecessary(value))
  return ''
}


const formatKeyValue = (key: string, value: string): string =>
  `${key}=${value}`

const formatObjectLogTag = (value: Record<string, unknown>): string => {
  const keys = Object.keys(value)
  return keys
    .map(key => formatKeyValue(key, safeStringify(value[key])))
    .join(' ')
}

export const formatLogTags = (logTags: Record<string, unknown>, baseKeys: string[]): string => {
  const tagsWithoutBaseKeys = _.omit(logTags, ...baseKeys)
  return Object.keys(tagsWithoutBaseKeys)
    .map(logTagKey => {
      if (isPrimitiveType(logTags[logTagKey])) {
        return formatKeyValue(logTagKey, formatPrimitiveLogTagValue(logTags[logTagKey]))
      }
      if (typeof logTags[logTagKey] === 'object') {
        return formatObjectLogTag({ [logTagKey]: logTags[logTagKey] })
      }
      return ''
    })
    .filter(x => x)
    .join(' ')
}

export const toTags = (s: string): LogTags => JSON.parse(s)

export const mergeLogTags = (currentTags: LogTags, newTags: LogTags): LogTags => {
  const mergedTags = { ...currentTags, ...newTags }
  return Object.fromEntries(Object.entries(mergedTags).filter(([, v]) => v !== undefined))
}
