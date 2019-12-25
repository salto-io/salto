import { Pool } from '@salto/persistent-pool'
import { Argv, CommandModule } from 'yargs'
import { Adapter, PoolOpts, GlobalArgs } from '../../types'
import { AsyncCommandHandler } from '../types'

export type ClearArgs = GlobalArgs & { adapter: string; id: string }

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<ClearArgs>
}

const commandModule = ({
  adapters,
  pool,
  asyncHandler,
}: Opts): CommandModule<{}, ClearArgs> => ({
  command: 'clear <adapter>',
  describe: 'removes all saved credentials for the specified adapter',
  builder: args => {
    args.positional('adapter', {
      type: 'string',
      choices: Object.keys(adapters),
    })

    return args as Argv<ClearArgs>
  },
  handler: asyncHandler(async (args: ClearArgs) => {
    const p = await pool({ globalArgs: args, adapterName: args.adapter })
    await p.clear()
    return 0
  }),
})

export default commandModule
