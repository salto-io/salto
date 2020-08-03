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
import { validateLogLevel } from './level'
import { Config, validateFormat } from './config'
import { toGlobalTags } from './log-tags'

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
    globalTags: envKey('GLOBAL_TAGS', toGlobalTags),
  }
}
