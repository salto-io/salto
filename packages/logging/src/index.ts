import {
  Config, mergeConfigs,
} from './internal/common'
import { loggerRepo } from './internal/repo'
import * as env from './internal/env'
import * as winston from './internal/winston'

export {
  ConfigValidationError as LogConfigValidationError,
  Config as LogConfig, LogLevel, Logger, LOG_LEVELS,
} from './internal/common'

export { compare as compareLogLevels } from './internal/levels'

const deps = {
  consoleStream: process.stdout,
  env: process.env,
}

const config: Config = mergeConfigs(env.config(deps.env))

const winstonRepo = winston.loggerRepo(deps, config)

export const logger = loggerRepo(winstonRepo, config)
