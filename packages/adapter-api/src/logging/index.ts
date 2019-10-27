import {
  Config, mergeConfigs, LoggerRepo,
} from './internal/common'
import { loggerRepo } from './internal/repo'
import * as env from './internal/env'
import * as winston from './internal/winston'

export {
  ConfigValidationError as LogConfigValidationError,
  Config as LogConfig, LogLevel, Logger,
} from './internal/common'
export { compare as compareLogLevels } from './internal/levels'

const deps: winston.Dependencies = {
  consoleStream: process.stdout,
}

const config: Config = mergeConfigs(env.config(process.env))

const winstonRepo = winston.loggerRepo(deps, config)

export const logger: LoggerRepo = loggerRepo(winstonRepo, config)
