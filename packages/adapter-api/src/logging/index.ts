import {
  Config, mergeConfigs, ROOT_NAMESPACE,
} from './internal/common'
import * as env from './internal/env'
import { loggerFromBasicLogger } from './internal/logger'
import * as winston from './internal/winston'

const deps: winston.Dependencies = {
  consoleStream: process.stdout,
}

const mergedConfig: Config = mergeConfigs(env.config(process.env))
const rootBasicLogger = winston.createLogger(deps, mergedConfig, ROOT_NAMESPACE)
const rootLogger = loggerFromBasicLogger(rootBasicLogger, mergedConfig, ROOT_NAMESPACE)

export const logger = rootLogger.child.bind(rootLogger)
export const configure = rootLogger.configure.bind(rootLogger)
