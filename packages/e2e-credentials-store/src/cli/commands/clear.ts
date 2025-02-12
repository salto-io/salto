/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Pool } from '@salto-io/persistent-pool'
import { Argv, CommandModule } from 'yargs'
import { Adapter, PoolOpts, GlobalArgs } from '../../types'
import { AsyncCommandHandler } from '../types'

type ClearArgs = GlobalArgs & { adapter: string; id: string }

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<ClearArgs>
}

const commandModule = ({ adapters, pool, asyncHandler }: Opts): CommandModule<{}, ClearArgs> => ({
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
