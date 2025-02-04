/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import * as remoteMap from '../remote_map'
import * as staticFiles from './cache'

const { awu } = collections.asynciterable

type StaticFilesCacheState = remoteMap.RemoteMap<staticFiles.StaticFilesData>

export const buildStaticFilesCache = (
  name: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  persistent: boolean,
): staticFiles.StaticFilesCache => {
  const createRemoteMap = async (cacheName: string): Promise<StaticFilesCacheState> =>
    remoteMapCreator.create<staticFiles.StaticFilesData>({
      namespace: `staticFilesCache-${cacheName}`,
      serialize: async cacheEntry => safeJsonStringify(cacheEntry),
      deserialize: async data => JSON.parse(data),
      persistent,
    })

  let cache = createRemoteMap(name)

  return {
    get: async (filepath: string): Promise<staticFiles.StaticFilesData | undefined> => (await cache).get(filepath),
    put: async (item: staticFiles.StaticFilesData): Promise<void> => {
      await (await cache).set(item.filepath, item)
    },
    putMany: async (items: staticFiles.StaticFilesData[]): Promise<void> => {
      await (await cache).setAll(items.map(item => ({ key: item.filepath, value: item })))
    },
    delete: async (filepath: string): Promise<void> => {
      await (await cache).delete(filepath)
    },
    deleteMany: async (filepaths: string[]): Promise<void> => {
      await (await cache).deleteAll(filepaths)
    },
    flush: async () => {
      await (await cache).flush()
    },
    clear: async () => {
      await (await cache).clear()
    },
    rename: async (newName: string) => {
      const currentCache = await cache
      const newCache = await createRemoteMap(newName)
      await newCache.setAll(currentCache.entries())
      cache = Promise.resolve(newCache)
      await currentCache.clear()
    },
    clone: () => buildStaticFilesCache(name, remoteMapCreator, persistent),
    list: async () => awu((await cache).keys()).toArray(),
  }
}
