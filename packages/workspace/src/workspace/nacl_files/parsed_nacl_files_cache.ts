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
import { Element, ElemID } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { hash, collections } from '@salto-io/lowerdash'
import { SourceMap } from '../../parser'
import { ContentType } from '../dir_store'
import { serialize, deserialize } from '../../serializer/elements'
import { StaticFilesSource } from '../static_files'
import { RemoteMapCreator, RemoteMap } from '../remote_map'
import { ParsedNaclFile, ParsedNaclFileData } from './parsed_nacl_file'
import { createInMemoryElementSource } from '../elements_source'

const { awu } = collections.asynciterable

type FileCacheMetdata = {
  timestamp: number
  hash: string
}

export type ParseResultKey = {
  filename: string
  lastModified: number
  buffer?: ContentType
}

type CacheSources = {
  elements: RemoteMap<Element[]>
  data: RemoteMap<ParsedNaclFileData>
  sourceMap: RemoteMap<SourceMap>
  metadata: RemoteMap<FileCacheMetdata>
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

const parseNaclFileFromCacheSources = async (
  cacheSources: CacheSources,
  filename: string
): Promise<ParsedNaclFile> => {
  const elements = createInMemoryElementSource()
  const cacheElements = await cacheSources.elements.get(filename)
  if (cacheElements !== undefined) {
    await elements.overide(cacheElements)
  }
  return {
    filename,
    elements,
    data: await cacheSources.data.get(filename) ?? { timestamp: 0, errors: [], referenced: [] },
    sourceMap: await cacheSources.sourceMap.get(filename),
  }
}

const getRemoteMapCacheNamespace = (
  cacheName: string,
  dataType: string,
  fileName?: string,
): string =>
  (fileName === undefined ? `parsedResultCache-${cacheName}-${dataType}` : `parsedResultCache-${cacheName}-${dataType}-${fileName}`)

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

const getCacheFilesList = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<string[]> => {
  const metadata = await getMetadata(cacheName, remoteMapCreator)
  return awu(metadata.keys()).toArray()
}

const getCacheSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<CacheSources> => ({
  metadata: await getMetadata(cacheName, remoteMapCreator),
  elements: await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'elements'),
    serialize: (elements: Element[]) => serialize(elements),
    deserialize: async data => (deserialize(
      data,
      async sf => staticFilesSource.getStaticFile(sf.filepath, sf.encoding),
    )),
  }),
  sourceMap: (await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'sourceMap'),
    serialize: (sourceMap: SourceMap) => safeJsonStringify(sourceMap),
    deserialize: data => JSON.parse(data),
  })),
  data: (await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'data'),
    serialize: (val: ParsedNaclFileData) => safeJsonStringify(val),
    deserialize: data => {
      const parsed = JSON.parse(data)
      return {
        ...parsed,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        referenced: parsed.referenced?.map((e: {[key: string]: any}) =>
          (new ElemID(
            e.adapter, e.typeName, e.idType, ...(e.nameParts ?? []),
          ))),
      }
    },
  })),
})

const copyAllSourcesToNewName = async (
  oldName: string,
  newName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<void> => {
  const oldCacheSources = await getCacheSources(oldName, remoteMapCreator, staticFilesSource)
  const newCacheSources = await getCacheSources(newName, remoteMapCreator, staticFilesSource)
  await newCacheSources.data.setAll(oldCacheSources.data.entries())
  await newCacheSources.elements.setAll(oldCacheSources.elements.entries())
  await newCacheSources.metadata.setAll(oldCacheSources.metadata.entries())
  await newCacheSources.sourceMap.setAll(oldCacheSources.sourceMap.entries())
}

const clearAllSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<void> => {
  const cacheSources = await getCacheSources(
    cacheName,
    remoteMapCreator,
    staticFilesSource
  )
  await awu(Object.values(cacheSources)).forEach(async source => source.clear())
}

export const createParseResultCache = (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): ParsedNaclFileCache => {
  // To allow renames
  let actualCacheName = cacheName
  return {
    put: async (key: Required<ParseResultKey>, value: ParsedNaclFile): Promise<void> => {
      const { metadata, data, sourceMap, elements } = await getCacheSources(
        actualCacheName,
        remoteMapCreator,
        staticFilesSource
      )
      await data.set(value.filename, value.data)
      if (value.sourceMap !== undefined) {
        await sourceMap.set(value.filename, value.sourceMap)
      } else {
        await sourceMap.delete(value.filename)
      }
      await elements.set(value.filename, await awu(await value.elements.getAll()).toArray())
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
      const cacheSources = await getCacheSources(
        actualCacheName,
        remoteMapCreator,
        staticFilesSource
      )
      return parseNaclFileFromCacheSources(cacheSources, key.filename)
    },
    delete: async (filename: string): Promise<void> => {
      const cacheSources = await getCacheSources(
        actualCacheName,
        remoteMapCreator,
        staticFilesSource
      )
      await awu(Object.values(cacheSources)).forEach(async source => source.delete(filename))
    },
    list: async () => getCacheFilesList(actualCacheName, remoteMapCreator),
    clear: async () => clearAllSources(actualCacheName, remoteMapCreator, staticFilesSource),
    rename: async (newName: string) => {
      const oldName = actualCacheName
      // Clearing leftover data in sources with the same name as the new one
      // Before copying the current cache data to it
      await clearAllSources(newName, remoteMapCreator, staticFilesSource)
      await copyAllSourcesToNewName(
        oldName,
        newName,
        remoteMapCreator,
        staticFilesSource,
      )
      await clearAllSources(oldName, remoteMapCreator, staticFilesSource)
      actualCacheName = newName
    },
    flush: async () => {
      const cacheSources = await getCacheSources(
        actualCacheName,
        remoteMapCreator,
        staticFilesSource
      )
      await awu(Object.values(cacheSources)).forEach(async source => source.flush())
    },
    // This is not right cause it will use the same remoteMaps
    clone: (): ParsedNaclFileCache =>
      createParseResultCache(cacheName, remoteMapCreator, staticFilesSource.clone()),
  }
}
