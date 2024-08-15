/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
