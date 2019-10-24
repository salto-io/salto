import {
  Config, LogLevel, EnabledForNamespaceChecker, Format, validateFormat, validateLogLevel,
} from './common'

export type Env = { [key: string]: string | undefined }

export const ENV_KEY_PREFIX = 'SALTO_LOG_'

const BOOLEAN_TRUE_VALUES = Object.freeze(['true', '1', 'yes'])

export const config = (env: Env): Partial<Config> => {
  const envKey = (k: string): string | undefined => env[ENV_KEY_PREFIX + k]

  const minLevel = (): LogLevel | undefined => {
    const val = envKey('LEVEL')
    if (val === undefined) return undefined
    return validateLogLevel(val)
  }

  const enabledForNamespace = (): EnabledForNamespaceChecker | undefined => {
    const val = envKey('NS')
    if (val === undefined) return undefined

    return val === '*'
      ? () => true
      : namespace => namespace === val
  }

  const format = (): Format | undefined => {
    const val = envKey('FORMAT')
    if (val === undefined) return undefined
    return validateFormat(val)
  }

  const toBoolean = (key: string): boolean | undefined => {
    const val = envKey(key)
    if (val === undefined) return undefined
    return BOOLEAN_TRUE_VALUES.includes(val)
  }

  const colorize = (): boolean | undefined => toBoolean('COLOR')

  return {
    minLevel: minLevel(),
    filename: envKey('FILE'),
    enabledForNamespace: enabledForNamespace(),
    format: format(),
    colorize: colorize(),
  }
}
