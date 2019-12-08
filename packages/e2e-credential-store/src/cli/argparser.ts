import { Writable } from 'stream'
import yargs from 'yargs/yargs'
import { Arguments, CommandModule } from 'yargs'
import { Pool, Repo } from '@salto/persistent-pool'
import { Adapter, PoolOpts } from '../types'
import { terminalWidth, writeLine } from './stream'
import { CliReturnCode } from './types'
import commands from './commands'

export type Parser = (argv: string[]) => Promise<CliReturnCode>

type ArgparserOpts = {
  stdout: Writable
  stderr: Writable
  adapters: Record<string, Adapter>
  repo: (tableName: string) => Promise<Repo>
}

const MAX_WIDTH = 100
export const DEFAULT_TABLE = 'e2e_credentials'

const argparser = ({
  stdout,
  stderr,
  adapters,
  repo,
}: ArgparserOpts): Parser => {
  const parser = yargs()

  let errorMessage: string | undefined

  parser
    .strict()
    .demandCommand()
    .options({
      table: {
        alias: 't',
        type: 'string',
        default: DEFAULT_TABLE,
      },
    })
    .exitProcess(false)
    .fail((msg, err) => {
      if (err) throw err
      errorMessage = msg
    })
    .wrap(Math.min(terminalWidth(stdout) ?? MAX_WIDTH, MAX_WIDTH) - 1)

  const pool = async (
    { globalArgs, adapterName }: PoolOpts
  ): Promise<Pool> => (await repo(globalArgs.table)).pool(adapterName)

  let commandPromise: Promise<CliReturnCode> | undefined

  const asyncHandler = <T>(
    handler: (argv: Arguments<T>) => Promise<CliReturnCode>,
  ): (args: Arguments<T>) => void => args => { commandPromise = handler(args) }

  const allCommands = [
    commands.register({ adapters, pool, asyncHandler }),
    commands.unregister({ adapters, pool, asyncHandler }),
    commands.list({ adapters, pool, asyncHandler, stdout }),
    commands.adapters({ adapters, stdout }),
    commands.clear({ adapters, pool, asyncHandler }),
    commands.free({ adapters, pool, asyncHandler, stderr }),
  ] as CommandModule[]

  allCommands.forEach(command => parser.command(command))

  const showHelp = (
    stream: Writable
  // @ts-ignore
  ): void => parser.showHelp(s => writeLine(stream, `Usage: ${s}`))

  return async argv => {
    if (argv.length === 0) {
      showHelp(stdout)
      return 1
    }

    parser.parse(argv)
    if (errorMessage !== undefined) {
      writeLine(stderr, errorMessage)
      writeLine(stderr)
      showHelp(stderr)
      return 1
    }

    if (commandPromise) {
      return commandPromise
    }

    return 0
  }
}

export default argparser
