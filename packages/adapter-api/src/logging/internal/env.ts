import {
  Config, LogLevel, EnabledForNamespaceChecker, Format, validateFormat,
} from './common'

export type Env = { [key: string]: string | undefined }

export const ENV_KEY_PREFIX = 'SALTO_LOG_'

const envKey = (env: Env, k: string): string | undefined => env[ENV_KEY_PREFIX + k]

const enabledForNamespace = (env: Env): EnabledForNamespaceChecker | undefined => {
  const ns = envKey(env, 'NS')

  if (ns === undefined) {
    return undefined // leave default as is
  }

  if (ns === '*') {
    return () => true
  }

  return namespace => namespace === ns
}

const format = (env: Env): Format | undefined => {
  const f = envKey(env, 'FORMAT')

  if (f === undefined) {
    return undefined
  }

  return validateFormat(f)
}

export const config = (env: Env): Partial<Config> => ({
  minLevel: envKey(env, 'LEVEL') as LogLevel | undefined,
  filename: envKey(env, 'FILE'),
  enabledForNamespace: enabledForNamespace(env),
  format: format(env),
})
