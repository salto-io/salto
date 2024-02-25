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
import { Writable } from 'stream'
import { Pool, InstanceNotLeasedError, InstanceNotFoundError } from '@salto-io/persistent-pool'
import { Argv, CommandModule } from 'yargs'
import { Adapter, GlobalArgs, PoolOpts } from '../../types'
import { AsyncCommandHandler } from '../types'
import { writeLine } from '../stream'

export type FreeArgs = GlobalArgs & { adapter: string; id: string }

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<FreeArgs>
  stderr: Writable
}

const commandModule = ({ adapters, pool, asyncHandler, stderr }: Opts): CommandModule<{}, FreeArgs> => ({
  command: 'free <adapter> <id>',
  describe: 'return a leased set of credentials to the pool',
  builder: args => {
    args.positional('adapter', {
      type: 'string',
      choices: Object.keys(adapters),
    })

    args.positional('id', {
      type: 'string',
    })

    return args as Argv<FreeArgs>
  },
  handler: asyncHandler(async (args: FreeArgs) => {
    const p = await pool({ globalArgs: args, adapterName: args.adapter })
    try {
      await p.return(args.id, { validateClientId: false })
    } catch (e) {
      if (e instanceof InstanceNotLeasedError) {
        // ok
      } else if (e instanceof InstanceNotFoundError) {
        writeLine(stderr, `Lease not found: "${args.id}"`)
        return 1
      } else {
        throw e
      }
    }

    return 0
  }),
})

export default commandModule
