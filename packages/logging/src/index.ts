/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Config, mergeConfigs } from './internal/config'
import { loggerRepo } from './internal/logger'
import * as env from './internal/env'
import * as pino from './internal/pino'

export { LogLevel } from './internal/level'
export { Logger } from './internal/logger'
export { Config as LogConfig } from './internal/config'
export { LogTags } from './internal/log-tags'

export { compare as compareLogLevels } from './internal/level'

const deps = {
  consoleStream: process.stdout,
  env: process.env,
}

const config: Config = mergeConfigs(env.config(deps.env))

const pinoRepo = pino.loggerRepo(deps, config)

export const logger = loggerRepo(pinoRepo, config)
