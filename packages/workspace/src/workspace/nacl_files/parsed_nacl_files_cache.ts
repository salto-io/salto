/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { hash, collections } from '@salto-io/lowerdash'
import { ContentType } from '../dir_store'
import { RemoteMapCreator, RemoteMap } from '../remote_map'
import { ParsedNaclFile } from './parsed_nacl_file'

const { awu } = collections.asynciterable

type FileCacheMetdata = {
  timestamp: number
  hash: string
}

type CacheSources = {
  metadata: RemoteMap<FileCacheMetdata>
  data: RemoteMap<ParsedNaclFile>
}

export type ParseResultKey = {
  filename: string
  lastModified: number
  buffer?: ContentType
}

export type ParsedNaclFileCache = {
  flush: () => Promise<void>
  clone: () => ParsedNaclFileCache
  clear: () => Promise<void>
  rename: (name: string) => Promise<void>
  list: () => Promise<string[]>
  delete: (filename: string) => Promise<void>
  get(key: ParseResultKey, allowInvalid?: boolean): Promise<ParsedNaclFile | undefined>
  put(key: ParseResultKey, value: ParsedNaclFile): Promise<void>
}

const isMD5Equal = (
  cacheMD5: string,
  buffer?: ContentType
): boolean => (buffer === undefined ? false : (hash.toMD5(buffer) === cacheMD5))

const shouldReturnCacheData = (
  key: ParseResultKey,
  fileCacheMetadata: FileCacheMetdata,
  allowInvalid = false
): boolean => (
  allowInvalid
  || isMD5Equal(fileCacheMetadata.hash, key.buffer)
  || fileCacheMetadata.timestamp >= key.lastModified
)

const getRemoteMapCacheNamespace = (
  cacheName: string,
  dataType: string,
  fileName?: string,
): string =>
  (fileName === undefined ? `parsedResultCache-${cacheName}-${dataType}` : `parsedResultCache-${cacheName}-${dataType}-${fileName}`)

const getParsedNaclFilesSources = (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<RemoteMap<ParsedNaclFile>> =>
  (remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'data'),
    serialize: safeJsonStringify,
    deserialize: JSON.parse,
  }))

const getMetadata = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<RemoteMap<FileCacheMetdata>> => (
  remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'metadata'),
    serialize: (val: FileCacheMetdata) => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
  })
)

const getCacheSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<CacheSources> => ({
  metadata: await getMetadata(cacheName, remoteMapCreator),
  data: await getParsedNaclFilesSources(cacheName, remoteMapCreator),
})

const getCacheFilesList = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<string[]> => {
  const metadata = await getMetadata(cacheName, remoteMapCreator)
  return awu(metadata.keys()).toArray()
}

const copyAllSourcesToNewName = async (
  oldName: string,
  newName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<void> => {
  const { metadata: oldMetadata, data: oldData } = await getCacheSources(
    oldName,
    remoteMapCreator,
  )
  const { metadata: newMetatadata, data: newData } = await getCacheSources(
    newName,
    remoteMapCreator,
  )
  await newData.setAll(oldData.entries())
  await newMetatadata.setAll(oldMetadata.entries())
}

const clearAllSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<void> => {
  const { metadata, data } = await getCacheSources(cacheName, remoteMapCreator)
  await data.clear()
  await metadata.clear()
}

export const createParseResultCache = (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): ParsedNaclFileCache => {
  // To allow renames
  let actualCacheName = cacheName
  return {
    put: async (key: Required<ParseResultKey>, value: ParsedNaclFile): Promise<void> => {
      const { metadata, data } = await getCacheSources(actualCacheName, remoteMapCreator)
      await data.set(value.filename, value)
      await metadata.set(key.filename, {
        hash: hash.toMD5(key.buffer),
        timestamp: Date.now(),
      })
    },
    get: async (key: ParseResultKey, allowInvalid = false): Promise<ParsedNaclFile | undefined> => {
      const metadata = await getMetadata(actualCacheName, remoteMapCreator)
      const fileMetadata = await metadata.get(key.filename)
      if (fileMetadata === undefined) {
        return undefined
      }
      if (!shouldReturnCacheData(key, fileMetadata, allowInvalid)) {
        return undefined
      }
      return (await getParsedNaclFilesSources(
        actualCacheName, remoteMapCreator
      )).get(key.filename)
    },
    delete: async (filename: string): Promise<void> => {
      const { metadata, data } = await getCacheSources(actualCacheName, remoteMapCreator)
      await data.delete(filename)
      await metadata.delete(filename)
    },
    list: async () => (getCacheFilesList(actualCacheName, remoteMapCreator)),
    clear: async () => (clearAllSources(actualCacheName, remoteMapCreator)),
    rename: async (newName: string) => {
      const oldName = actualCacheName
      // Clearing leftover data in sources with the same name as the new one
      // Before copying the current cache data to it
      await clearAllSources(newName, remoteMapCreator)
      await copyAllSourcesToNewName(
        oldName,
        newName,
        remoteMapCreator,
      )
      await clearAllSources(oldName, remoteMapCreator)
      actualCacheName = newName
    },
    flush: async () => {
      const { metadata, data } = await getCacheSources(actualCacheName, remoteMapCreator)
      await data.flush()
      await metadata.flush()
    },
    // This is not right cause it will use the same remoteMaps
    clone: (): ParsedNaclFileCache =>
      createParseResultCache(cacheName, remoteMapCreator),
  }
}
