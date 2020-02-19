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
import { Minimatch } from 'minimatch'
import { validateOneOf } from './common'
import { LogLevel } from './level'
import { Namespace } from './namespace'

export type Format = 'json' | 'text'
export const FORMATS: ReadonlyArray<Format> = Object.freeze(['json', 'text'])
export const validateFormat = (f: string): Format => validateOneOf(FORMATS, 'log format', f)

export type NamespaceFilter = (namespace: Namespace) => boolean

export type Config = {
  minLevel: LogLevel | 'none'
  filename: string | null
  format: Format
  namespaceFilter: NamespaceFilter | string
  colorize: boolean | null
}

export const DEFAULT_CONFIG: Readonly<Config> = Object.freeze({
  minLevel: 'none',
  filename: null,
  format: 'text',
  namespaceFilter: '*',
  colorize: null,
})

export const stringToNamespaceFilter = (filter: string): NamespaceFilter => {
  if (filter === '*') {
    return () => true
  }

  const m = new Minimatch(filter)
  return m.match.bind(m)
}

export const mergeConfigs = (...configs: Partial<Config>[]): Config => _.defaults(
  {}, ...[DEFAULT_CONFIG, ...configs].reverse()
)

export const cloneConfig = (c: Readonly<Config>): Config => ({ ...c })
