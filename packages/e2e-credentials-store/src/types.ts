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
import yargs from 'yargs'

export type Adapter<TArgs extends {} = {}, TCreds extends {} = {}> = {
  name: string
  credentialsOpts: Record<string, yargs.Options>
  credentials(args: yargs.Arguments<TArgs>): Promise<TCreds>
  validateCredentials(creds: TCreds): Promise<void>
}

export type GlobalArgs = {
  table: string
}

export type PoolOpts = {
  globalArgs: GlobalArgs
  adapterName: string
}

export class SuspendCredentialsError extends Error {
  constructor(
    readonly reason: Error,
    readonly timeout: number,
  ) {
    super(`Credentials validation error: ${reason}, suspending for ${timeout} ms`)
  }
}
