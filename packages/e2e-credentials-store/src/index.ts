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
import cliMain from './cli'

export { default as creds, CredsSpec, CredsLease } from './jest-environment/creds'

export { default as createEnvUtils } from './process_env'
export { SaltoE2EJestEnvironment, JestEnvironmentConstructorArgs } from './jest-environment/index'
export { default as IntervalScheduler } from './jest-environment/interval_scheduler'
export * from './types'
export const cli = { main: cliMain }
