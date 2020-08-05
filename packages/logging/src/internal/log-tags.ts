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
import { ValidationError } from './common'

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

const formatLogTag = (key: string, value: unknown): string => {
  if (typeof value === 'number') return `${key}=${value.toString()}`
  if (typeof value === 'string') return `${key}=${stringifyIfNecessary(value)}`
  if (typeof value === 'boolean') return `${key}=${value.toString()}`
  return ''
}

export const isLogTagValueType = (value: unknown): boolean =>
  typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'

export const formatLogTags = (logTags: Record<string, unknown>, baseKeys: string[]): string => {
  const tagsWithoutBaseKeys = _.omit(logTags, ...baseKeys)
  return Object.keys(tagsWithoutBaseKeys)
    .map(logTagKey => formatLogTag(logTagKey, logTags[logTagKey]))
    .join(' ')
}

export const toTags = (s: string): LogTags => {
  try {
    return JSON.parse(s)
  } catch (e) {
    throw new ValidationError('Invalid LogTags given')
  }
}

export const mergeLogTags = (currentTags: LogTags, newTags: LogTags): LogTags => {
  const mergedTags = { ...currentTags, ...newTags }
  Object.keys(mergedTags).forEach(
    key => mergedTags[key] === undefined && delete mergedTags[key]
  )
  return mergedTags
}
