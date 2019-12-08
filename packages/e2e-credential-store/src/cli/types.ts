import { Arguments } from 'yargs'

export type CliReturnCode = 0 | 1

export type AsyncCommandHandler<T extends {} = {}> = (
  handler: (argv: Arguments<T>) => Promise<CliReturnCode>,
) => (args: Arguments<T>) => void
