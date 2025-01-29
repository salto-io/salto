/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Config, mergeConfigs } from './src/config'
import { loggerRepo } from './src/logger'
import * as env from './src/env'
import * as pino from './src/pino'

export { LogLevel } from './src/level'
export { Logger } from './src/logger'
export { Config as LogConfig } from './src/config'
export { LogTags } from './src/log-tags'

export { compare as compareLogLevels } from './src/level'

const deps = {
  consoleStream: process.stdout,
  env: process.env,
}

const config: Config = mergeConfigs(env.config(deps.env))

const pinoRepo = pino.loggerRepo(deps, config)

export const logger = loggerRepo(pinoRepo, config)
