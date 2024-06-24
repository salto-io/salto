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
import { Pool } from '@salto-io/persistent-pool'
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

const commandModule = ({ adapters, pool, asyncHandler, stderr, stdout }: Opts): CommandModule<{}, LeaseArgs> => ({
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
