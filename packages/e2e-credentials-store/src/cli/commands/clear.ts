/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Pool } from '@salto-io/persistent-pool'
import { Argv, CommandModule } from 'yargs'
import { Adapter, PoolOpts, GlobalArgs } from '../../types'
import { AsyncCommandHandler } from '../types'

export type ClearArgs = GlobalArgs & { adapter: string; id: string }

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
