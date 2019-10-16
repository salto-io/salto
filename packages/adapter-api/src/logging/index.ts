import {
  Config, mergeConfigs, ROOT_NAMESPACE,
} from './internal/common'
import { config as envConfig } from './internal/env'
import { loggerFromBasicLogger } from './internal/logger'
import { createLogger, Dependencies } from './internal/winston'

const deps: Dependencies = {
  consoleStream: process.stdout,
}

const mergedConfig: Config = mergeConfigs(envConfig(process.env))

const rootBasicLogger = createLogger(deps, mergedConfig, ROOT_NAMESPACE)

const rootLogger = loggerFromBasicLogger(rootBasicLogger, mergedConfig, ROOT_NAMESPACE)

export const logger = rootLogger.child
