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
import { byName as colorsByName } from './colors'
import { ValidationError } from './common'

export type LogTags = {
  [key: string]: unknown
}

export const LOG_TAGS_COLOR = colorsByName.Olive

const formatLogTag = (key: string, logTag: unknown): string => {
  if (typeof logTag === 'number') return `${key}-${logTag.toString()}`
  if (typeof logTag === 'string') return `${key}-${logTag}`
  return `${key}-${JSON.stringify(logTag)}`
}

export const formatLogTags = (logTags: LogTags, baseKeys: string[]): string => {
  const tagsWithoutBaseKeys = _.omit(logTags, ...baseKeys)
  return Object.keys(tagsWithoutBaseKeys)
    .map(logTagKey => formatLogTag(logTagKey, logTags[logTagKey]))
    .join(' ')
}

export const toGlobalTags = (s: string): LogTags => {
  try {
    return JSON.parse(s)
  } catch (e) {
    throw new ValidationError('Invalid globalLogTags given')
  }
}
