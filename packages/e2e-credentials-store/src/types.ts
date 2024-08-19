/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
