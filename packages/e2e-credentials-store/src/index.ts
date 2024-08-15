/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import cliMain from './cli'

export { default as creds, CredsSpec, CredsLease } from './jest-environment/creds'

export { default as createEnvUtils } from './process_env'
export { SaltoE2EJestEnvironment, JestEnvironmentConstructorArgs } from './jest-environment/index'
export { default as IntervalScheduler } from './jest-environment/interval_scheduler'
export * from './types'
export const cli = { main: cliMain }
