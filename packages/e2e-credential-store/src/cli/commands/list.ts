import { Writable } from 'stream'
import { Pool, LeaseWithStatus } from '@salto/persistent-pool'
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

const listPretty: Lister = async iterable => {
  const t = new Table()
  const now = Date.now()
  const iter = iterable[Symbol.asyncIterator]()
  const next = async (): Promise<void> => {
    const { done, value } = await iter.next()
    if (done) return undefined
    t.cell('id', value.id)
    t.cell('status', value.status)
    if (value.status === 'leased') {
      t.cell('clientId', value.clientId)
      const duration = now - value.leaseExpiresBy.getTime()
      t.cell('expires', humanizeDuration(duration, { round: true }))
    }
    t.newRow()
    return next()
  }
  await next()
  return t.columns().length > 0 ? t.toString() : ''
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
