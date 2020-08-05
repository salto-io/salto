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

export type LogTags = Record<string, string | number | boolean | undefined>

export const LOG_TAGS_COLOR = colorsByName.Olive

const stringifyIfNecessary = (s: string): string => {
  try { // If string is already stringified, don't stringify again
    JSON.parse(s)
    return s
  } catch (e) {
    return s.match(/^.*(\n|\t|").*$/) ? safeStringify(s) : s
  }
}

export const formatLogTagValue = (value: unknown): string => {
  if (typeof value === 'number' || typeof value === 'boolean') return `${value.toString()}`
  if (typeof value === 'string') return `${stringifyIfNecessary(value)}`
  return ''
}

export const isPrimitiveType = (value: unknown): value is string | number | boolean =>
  ['string', 'number', 'boolean'].includes(typeof value)

export const formatLogTags = (logTags: Record<string, unknown>, baseKeys: string[]): string => {
  const tagsWithoutBaseKeys = _.omit(logTags, ...baseKeys)
  return Object.keys(tagsWithoutBaseKeys)
    .map(logTagKey => (
      isPrimitiveType(logTags[logTagKey])
        ? `${logTagKey}=${formatLogTagValue(logTags[logTagKey])}`
        : ''
    ))
    .filter(x => x)
    .join(' ')
}

export const toTags = (s: string): LogTags => JSON.parse(s)

export const mergeLogTags = (currentTags: LogTags, newTags: LogTags): LogTags => {
  const mergedTags = { ...currentTags, ...newTags }
  return Object.fromEntries(Object.entries(mergedTags).filter(([, v]) => v !== undefined))
}
