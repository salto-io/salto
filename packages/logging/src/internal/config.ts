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
