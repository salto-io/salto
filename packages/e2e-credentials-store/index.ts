/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import cliMain from './src/cli'

export { default as creds, CredsSpec, CredsLease } from './src/jest-environment/creds'

export { default as createEnvUtils } from './src/process_env'
export { default as SaltoE2EJestEnvironment, JestEnvironmentConstructorArgs } from './src/jest-environment/index'
export { default as IntervalScheduler } from './src/jest-environment/interval_scheduler'
export * from './src/types'
export const cli = { main: cliMain }
