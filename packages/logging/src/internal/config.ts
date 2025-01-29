/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Minimatch } from 'minimatch'
import { validateOneOf } from './common'
import { LogLevel } from './level'
import { Namespace } from './namespace'
import { LogTags } from './log-tags'

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
  globalTags: LogTags
  maxJsonLogChunkSize: number
  maxTagsPerLogMessage: number
}

export const DEFAULT_CONFIG: Readonly<Config> = Object.freeze({
  minLevel: 'none',
  filename: null,
  format: 'text',
  namespaceFilter: '*',
  colorize: null,
  globalTags: {},
  maxJsonLogChunkSize: 25 * 1024, // 25K, DataDog recommended limit
  maxTagsPerLogMessage: 100,
})

export const stringToNamespaceFilter = (filter: string): NamespaceFilter => {
  if (filter === '*') {
    return () => true
  }

  const m = new Minimatch(filter)
  return m.match.bind(m)
}

export const mergeConfigs = (...configs: Partial<Config>[]): Config =>
  _.defaults({}, ...[DEFAULT_CONFIG, ...configs].reverse())

export const cloneConfig = (c: Readonly<Config>): Config => ({ ...c })
