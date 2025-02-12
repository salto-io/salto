/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { validateLogLevel } from './level'
import { Config, validateFormat } from './config'
import { toTags } from './log-tags'
import { validateLogFile } from './log-file'
import { ValidationError } from './common'

type Env = { [key: string]: string | undefined }

const ENV_KEY_PREFIX = 'SALTO_LOG_'

const BOOLEAN_TRUE_VALUES = Object.freeze(['true', '1', 'yes'])

export const config = (env: Env): Partial<Config> => {
  const envKey = <T>(k: string, transform: (s: string) => T): T | undefined => {
    const val = env[ENV_KEY_PREFIX + k]
    return val === undefined || val === '' ? undefined : transform(val)
  }

  const toBoolean = (val: string): boolean => BOOLEAN_TRUE_VALUES.includes(val)
  const toNumber = (val: string): number => {
    if (Number.isNaN(Number(val))) {
      throw new ValidationError(`invalid value "${val}", expected number`)
    }
    return Number(val)
  }

  return {
    minLevel: envKey('LEVEL', validateLogLevel),
    filename: envKey('FILE', validateLogFile),
    namespaceFilter: envKey('NS', s => s),
    format: envKey('FORMAT', validateFormat),
    colorize: envKey('COLOR', toBoolean),
    globalTags: envKey('GLOBAL_TAGS', toTags),
    maxJsonLogChunkSize: envKey('MAX_JSON_LOG_CHUNK_SIZE', toNumber),
    maxTagsPerLogMessage: envKey('MAX_TAGS_PER_LOG_MESSAGE', toNumber),
  }
}
