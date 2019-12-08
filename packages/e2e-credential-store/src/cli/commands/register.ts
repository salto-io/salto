import { Pool } from '@salto/persistent-pool'
import { Argv, CommandModule, Arguments } from 'yargs'
import { Adapter, PoolOpts, GlobalArgs } from '../../types'
import { AsyncCommandHandler } from '../types'

export type RegisterArgs = GlobalArgs & { id: string } & Record<string, string>

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<RegisterArgs>
}

const commandModule = ({
  adapters,
  pool,
  asyncHandler,
}: Opts): CommandModule<{}, {}> => ({
  command: 'register <adapter>',
  describe: 'register a new set of credentials',
  builder: y => {
    Object.entries(adapters).forEach(([adapterName, adapter]) => {
      y.command({
        command: `${adapterName} <id>`,
        builder: (args: Argv<{}>): Argv<RegisterArgs> => {
          args.positional('id', {
            type: 'string',
          })

          args.options(adapter.credentialsOpts)

          return args as Argv<RegisterArgs>
        },
        handler: asyncHandler(async (args: Arguments<RegisterArgs>) => {
          const p = await pool({ globalArgs: args, adapterName })
          await p.register(adapter.credentials(args), args.id)
          return 0
        }),
      })
    })
    return y as Argv<{}>
  },
  handler: () => undefined,
})

export default commandModule
