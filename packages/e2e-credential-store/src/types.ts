import yargs from 'yargs'

export type Adapter<TArgs extends {} = {}, TCreds extends {} = {}> = {
  name: string
  credentialsOpts: Record<string, yargs.Options>
  credentials(args: yargs.Arguments<TArgs>): TCreds
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
