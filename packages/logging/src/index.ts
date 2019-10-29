import { Config, mergeConfigs } from './internal/config'
import { loggerRepo } from './internal/logger'
import * as env from './internal/env'
import * as winston from './internal/winston'

export { LogLevel, LOG_LEVELS } from './internal/level'
export { Logger } from './internal/logger'
export { Config as LogConfig } from './internal/config'
export {
  ValidationError as LogConfigValidationError,

} from './internal/common'

export { compare as compareLogLevels } from './internal/level'

const deps = {
  consoleStream: process.stdout,
  env: process.env,
}

const config: Config = mergeConfigs(env.config(deps.env))

const winstonRepo = winston.loggerRepo(deps, config)

export const logger = loggerRepo(winstonRepo, config)
