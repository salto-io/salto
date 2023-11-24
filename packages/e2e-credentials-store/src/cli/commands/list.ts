/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Pool, LeaseWithStatus } from '@salto-io/persistent-pool'
import { Argv, CommandModule } from 'yargs'
import humanizeDuration from 'humanize-duration'
import Table from 'easy-table'
import { Adapter, PoolOpts, GlobalArgs } from '../../types'
import { AsyncCommandHandler } from '../types'
import { writeLine } from '../stream'

type Lister = (
  iterable: AsyncIterable<LeaseWithStatus<unknown>>,
) => Promise<string>

type ListFormat = 'json' | 'pretty'

type LeaseWithClientID<T> = LeaseWithStatus<T> & {
  'clientId' : unknown
  'leaseExpiresBy': Date
}

const listPretty: Lister = async iterable => {
  const t = new Table()
  const now = Date.now()
  const iter = iterable[Symbol.asyncIterator]()
  const next = async (): Promise<void> => {
    const { done, value } = await iter.next()
    if (done) return undefined
    t.cell('id', value.id)
    t.cell('status', value.status)
    if ((value as LeaseWithClientID<unknown>).clientId !== undefined) {
      t.cell('clientId', (value as LeaseWithClientID<unknown>).clientId)
    }
    if ((value as LeaseWithClientID<unknown>).leaseExpiresBy !== undefined) {
      const duration = now - (value as LeaseWithClientID<unknown>).leaseExpiresBy.getTime()
      t.cell('expires', humanizeDuration(duration, { round: true, largest: 1 }))
    }
    if (value.status === 'suspended') {
      t.cell('reason', value.suspensionReason)
    }
    t.newRow()
    return next()
  }
  await next()
  return t.toString().trim()
}

const listJson: Lister = async iterable => {
  const rows: unknown[] = []
  const iter = iterable[Symbol.asyncIterator]()
  const next = async (): Promise<void> => {
    const { done, value } = await iter.next()
    if (done) return undefined
    rows.push(value)
    return next()
  }
  await next()
  // eslint-disable-next-line no-restricted-syntax
  return JSON.stringify(rows)
}

const listers: Record<ListFormat, Lister> = {
  json: listJson,
  pretty: listPretty,
}

type ListArgs = GlobalArgs & { adapter: string; format: ListFormat }

type Opts = {
  adapters: Record<string, Adapter>
  pool: (opts: PoolOpts) => Promise<Pool>
  asyncHandler: AsyncCommandHandler<ListArgs>
  stdout: Writable
}

const commandModule = ({
  adapters,
  pool,
  asyncHandler,
  stdout,
}: Opts): CommandModule<{}, ListArgs> => ({
  command: 'list <adapter>',
  describe: 'lists registered credentials',
  builder: (args: Argv<{}>): Argv<ListArgs> => {
    args.positional('adapter', {
      type: 'string',
      choices: Object.keys(adapters),
    })

    args.option('format', {
      type: 'string',
      choices: ['json', 'pretty'] as ListFormat[],
      default: 'pretty',
    })

    return args as Argv<ListArgs>
  },
  handler: asyncHandler(async (args: ListArgs) => {
    const iter = await pool({ globalArgs: args, adapterName: args.adapter })
    writeLine(stdout, await listers[args.format](iter))
    return 0
  }),
})

export default commandModule
