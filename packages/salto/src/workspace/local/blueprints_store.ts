import BlueprintsStore, { BP_EXTENSION } from '../blueprints_store'
import { localDirectoryStore } from './dir_store'


export const localBlueprintsStore = (dir: string): BlueprintsStore => {
  const dirStore = localDirectoryStore(dir, `*${BP_EXTENSION}`)
  return {
    list: dirStore.list,
    get: dirStore.get,
    set: dirStore.set,
    delete: dirStore.delete,
    flush: dirStore.flush,
  }
}
