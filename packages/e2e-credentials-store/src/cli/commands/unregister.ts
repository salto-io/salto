/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Writable } from 'stream'
import { Pool, InstanceNotFoundError } from '@salto-io/persistent-pool'
import { Argv, CommandModule } from 'yargs'
import { Adapter, GlobalArgs, PoolOpts } from '../../types'
import { AsyncCommandHandler } from '../types'
import { writeLine } from '../stream'

type UnregisterArgs = GlobalArgs & { adapter: string; id: string }

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<UnregisterArgs>
  stderr: Writable
}

const commandModule = ({ adapters, pool, asyncHandler, stderr }: Opts): CommandModule<{}, UnregisterArgs> => ({
  command: 'unregister <adapter> <id>',
  describe: 'remove an existing set of credentials',
  builder: args => {
    args.positional('adapter', {
      type: 'string',
      choices: Object.keys(adapters),
    })

    args.positional('id', {
      type: 'string',
    })

    return args as Argv<UnregisterArgs>
  },
  handler: asyncHandler(async (args: UnregisterArgs) => {
    const p = await pool({ globalArgs: args, adapterName: args.adapter })
    try {
      await p.unregister(args.id)
    } catch (e) {
      if (e instanceof InstanceNotFoundError) {
        writeLine(stderr, `Lease not found: "${args.id}"`)
        return 1
      }
      throw e
    }
    return 0
  }),
})

export default commandModule
