import { logger } from '@salto/logging'
import { InstanceElement } from 'adapter-api'
import { parse } from '../../parser/parse'
import Credentials from '../credentials'
import { dump } from '../../parser/dump'
import { localBlueprintsStore } from './blueprints_store'
import { BP_EXTENSION } from '../blueprints_store'

const log = logger(module)

export const localCredentials = (credsDir: string): Credentials => {
  const bpStore = localBlueprintsStore(credsDir)
  const filename = (adapter: string): string => adapter.concat(BP_EXTENSION)

  return {
    get: async (adapter: string): Promise<InstanceElement | undefined> => {
      const bp = await bpStore.get(filename(adapter))
      return bp
        ? parse(Buffer.from(bp.buffer), bp.filename).elements.pop() as InstanceElement
        : undefined
    },

    set: async (adapter: string, credentials: InstanceElement): Promise<void> => {
      await bpStore.set({ filename: filename(adapter), buffer: dump([credentials]) })
      await bpStore.flush()
      log.info('set credentials for %s', adapter)
    },
  }
}
