/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Writable } from 'stream'
import { Pool } from '@salto-io/persistent-pool'
import { Argv, CommandModule, Arguments } from 'yargs'
import { Adapter, PoolOpts, GlobalArgs } from '../../types'
import { AsyncCommandHandler } from '../types'
import { writeLine } from '../stream'

type RegisterArgs = GlobalArgs & { id: string } & Record<string, string>

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<RegisterArgs>
  stderr: Writable
}

const commandModule = ({ adapters, pool, asyncHandler, stderr }: Opts): CommandModule<{}, {}> => ({
  command: 'register <adapter> ...',
  describe: 'register a new set of credentials',
  builder: y => {
    y.demandCommand(1, `Invalid adapter, should be one of: ${Object.keys(adapters)}`)
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
          const creds = await adapter.credentials(args)
          try {
            await adapter.validateCredentials(creds)
          } catch (e) {
            writeLine(stderr, `Credentials validation error: ${e}`)
            return 1
          }
          const p = await pool({ globalArgs: args, adapterName })
          await p.register(creds, args.id)
          return 0
        }),
      })
    })
    return y
  },
  handler: () => undefined,
})

export default commandModule
