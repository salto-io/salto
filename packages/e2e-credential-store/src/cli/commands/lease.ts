import { Writable } from 'stream'
import { Pool } from '@salto/persistent-pool'
import { Argv, CommandModule } from 'yargs'
import { Adapter, GlobalArgs, PoolOpts } from '../../types'
import { AsyncCommandHandler } from '../types'
import { writeLine } from '../stream'

export type LeaseArgs = GlobalArgs & { adapter: string; seconds: number }

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<LeaseArgs>
  stderr: Writable
  stdout: Writable
}

const commandModule = ({
  adapters,
  pool,
  asyncHandler,
  stderr,
  stdout,
}: Opts): CommandModule<{}, LeaseArgs> => ({
  command: 'lease <adapter> [seconds]',
  describe: 'lease a random set of credentials from the pool',
  builder: args => {
    args.positional('adapter', {
      type: 'string',
      choices: Object.keys(adapters),
    })

    args.positional('seconds', {
      type: 'number',
      default: 10 * 60,
    })

    return args as Argv<LeaseArgs>
  },
  handler: asyncHandler(async (args: LeaseArgs) => {
    const p = await pool({ globalArgs: args, adapterName: args.adapter })
    const lease = await p.lease(args.seconds * 1000)
    if (lease === null) {
      writeLine(stderr, 'No lease available')
      return 1
    }

    writeLine(stdout, JSON.stringify(lease))
    return 0
  }),
})

export default commandModule
