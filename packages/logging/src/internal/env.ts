import { validateLogLevel } from './level'
import { Config, validateFormat } from './config'

export type Env = { [key: string]: string | undefined }

export const ENV_KEY_PREFIX = 'SALTO_LOG_'

const BOOLEAN_TRUE_VALUES = Object.freeze(['true', '1', 'yes'])

export const config = (env: Env): Partial<Config> => {
  const envKey = <T>(
    k: string,
    transform: (s: string) => T,
  ): T | undefined => {
    const val = env[ENV_KEY_PREFIX + k]
    return val === undefined || val === '' ? undefined : transform(val)
  }

  const toBoolean = (val: string): boolean => BOOLEAN_TRUE_VALUES.includes(val)

  return {
    minLevel: envKey('LEVEL', validateLogLevel),
    filename: envKey('FILE', s => s),
    namespaceFilter: envKey('NS', s => s),
    format: envKey('FORMAT', validateFormat),
    colorize: envKey('COLOR', toBoolean),
  }
}
