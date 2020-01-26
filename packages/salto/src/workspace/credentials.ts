import { InstanceElement } from 'adapter-api'
import { logger } from '@salto/logging'
import { parse } from '../parser/parse'
import { dump } from '../parser/dump'
import { BP_EXTENSION } from './blueprints/blueprints_source'
import { DirectoryStore } from './dir_store'

const log = logger(module)

export default interface Credentials {
  get(adapter: string): Promise<InstanceElement | undefined>
  set(adapter: string, credentials: InstanceElement): Promise<void>
}

export const adapterCredentials = (dirStore: DirectoryStore): Credentials => {
  const filename = (adapter: string): string => adapter.concat(BP_EXTENSION)

  return {
    get: async (adapter: string): Promise<InstanceElement | undefined> => {
      const bp = await dirStore.get(filename(adapter))
      return bp
        ? parse(Buffer.from(bp.buffer), bp.filename).elements.pop() as InstanceElement
        : undefined
    },

    set: async (adapter: string, creds: InstanceElement): Promise<void> => {
      await dirStore.set({ filename: filename(adapter), buffer: dump([creds]) })
      await dirStore.flush()
      log.info('set credentials for %s', adapter)
    },
  }
}
