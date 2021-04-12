/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { hash, collections } from '@salto-io/lowerdash'
import { SourceMap, ParseError } from '../../parser'
import { ContentType } from '../dir_store'
import { serialize, deserialize } from '../../serializer/elements'
import { StaticFilesSource } from '../static_files'
import { RemoteMapCreator, RemoteMap } from '../remote_map'
import { ParsedNaclFile } from './parsed_nacl_file'

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
  sourceMap: RemoteMap<SourceMap>
  metadata: RemoteMap<FileCacheMetdata>
  errors: RemoteMap<ParseError[]>
  referenced: RemoteMap<string[]>
}

export type ParsedNaclFileCache = {
  flush: () => Promise<void>
  clone: () => ParsedNaclFileCache
  clear: () => Promise<void>
  rename: (name: string) => Promise<void>
  list: () => Promise<string[]>
  delete: (filename: string) => Promise<void>
  get(filename: string): Promise<ParsedNaclFile>
  put(filename: string, value: ParsedNaclFile): Promise<void>
  hasValid(key: ParseResultKey): Promise<boolean>
  getAllErrors(): Promise<ParseError[]> // TEMP
}

const isMD5Equal = (
  cacheMD5: string,
  buffer?: ContentType
): boolean => ((buffer === undefined || buffer === '')
  ? false
  : (hash.toMD5(buffer) === cacheMD5))

const isCacheDataRelevant = (
  key: ParseResultKey,
  fileCacheMetadata: FileCacheMetdata,
): boolean => (
  fileCacheMetadata.timestamp >= key.lastModified
  || isMD5Equal(fileCacheMetadata.hash, key.buffer)
)

const parseNaclFileFromCacheSources = async (
  cacheSources: CacheSources,
  filename: string
): Promise<ParsedNaclFile> => ({
  filename,
  elements: () => cacheSources.elements.get(filename),
  data: {
    errors: () => cacheSources.errors.get(filename),
    referenced: () => cacheSources.referenced.get(filename),
    timestamp: async () => (await cacheSources.metadata.get(filename))?.timestamp,
  },
  sourceMap: () => cacheSources.sourceMap.get(filename),
})

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

const getErrors = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<RemoteMap<ParseError[]>> => (
  remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'errors'),
    serialize: (errors: ParseError[]) => safeJsonStringify(errors ?? []),
    deserialize: data => JSON.parse(data),
  })
)

const getCacheSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<CacheSources> => ({
  metadata: await getMetadata(cacheName, remoteMapCreator),
  elements: await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'elements'),
    serialize: (elements: Element[]) => serialize(elements ?? []),
    deserialize: async data => (deserialize(
      data,
      async sf => staticFilesSource.getStaticFile(sf.filepath, sf.encoding),
    )),
  }),
  sourceMap: (await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'sourceMap'),
    serialize: (sourceMap: SourceMap) => safeJsonStringify(Array.from(sourceMap.entries())),
    deserialize: async data => (new SourceMap(JSON.parse(data))),
  })),
  errors: await getErrors(cacheName, remoteMapCreator),
  referenced: (await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'referenced'),
    serialize: (val: string[]) => safeJsonStringify(val ?? []),
    deserialize: data => (JSON.parse(data)),
  })),
})

const copyAllSourcesToNewName = async (
  oldCacheSources: CacheSources,
  newCacheSources: CacheSources,
): Promise<void> => {
  await newCacheSources.errors.setAll(oldCacheSources.errors.entries())
  await newCacheSources.referenced.setAll(oldCacheSources.referenced.entries())
  await newCacheSources.elements.setAll(oldCacheSources.elements.entries())
  await newCacheSources.metadata.setAll(oldCacheSources.metadata.entries())
  await newCacheSources.sourceMap.setAll(oldCacheSources.sourceMap.entries())
}

export const createParseResultCache = (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): ParsedNaclFileCache => {
  // To allow renames
  let actualCacheName = cacheName
  let cacheSources = getCacheSources(
    actualCacheName,
    remoteMapCreator,
    staticFilesSource
  )
  return {
    put: async (filename: string, value: ParsedNaclFile): Promise<void> => {
      const { metadata, errors, referenced, sourceMap, elements } = await cacheSources
      const fileErrors = await value.data.errors()
      if (fileErrors && fileErrors.length > 0) {
        await errors.set(value.filename, fileErrors)
      } else {
        await errors.delete(value.filename)
      }
      await referenced.set(value.filename, (await value.data.referenced()) ?? [])
      const sourceMapValue = await value.sourceMap?.()
      if (sourceMapValue !== undefined) {
        await sourceMap.set(value.filename, sourceMapValue)
      } else {
        await sourceMap.delete(value.filename)
      }
      await elements.set(value.filename, (await value.elements()) ?? [])
      await metadata.set(filename, {
        hash: hash.toMD5(value.buffer ?? ''),
        timestamp: (await value.data.timestamp()) ?? Date.now(),
      })
    },
    hasValid: async (key: ParseResultKey): Promise<boolean> => {
      const fileMetadata = await (await cacheSources).metadata.get(key.filename)
      if (fileMetadata === undefined) {
        return false
      }
      return isCacheDataRelevant(key, fileMetadata)
    },
    getAllErrors: async (): Promise<ParseError[]> =>
      (await awu((await cacheSources).errors.values()).toArray()).flat(),
    get: async (filename: string): Promise<ParsedNaclFile> => {
      const sources = await cacheSources
      return parseNaclFileFromCacheSources(
        sources,
        filename,
      )
    },
    delete: async (filename: string): Promise<void> =>
      (awu(Object.values(await cacheSources)).forEach(async source => source.delete(filename))),
    list: async () => awu((await cacheSources).metadata.keys()).toArray(),
    clear: async () =>
      awu(Object.values((await cacheSources))).forEach(async source => source.clear()),
    rename: async (newName: string) => {
      // Clearing leftover data in sources with the same name as the new one
      // Before copying the current cache data to it
      const newCacheSources = await getCacheSources(
        newName,
        remoteMapCreator,
        staticFilesSource
      )
      await awu(Object.values(newCacheSources)).forEach(async source => source.clear())
      const oldCacheSources = await cacheSources
      await copyAllSourcesToNewName(
        oldCacheSources,
        newCacheSources,
      )
      await awu(Object.values(oldCacheSources)).forEach(async source => source.clear())
      actualCacheName = newName
      cacheSources = Promise.resolve(newCacheSources)
    },
    flush: async () => awu(Object.values((await cacheSources))).forEach(source => source.flush()),
    clone: (): ParsedNaclFileCache =>
      createParseResultCache(cacheName, remoteMapCreator, staticFilesSource.clone()),
  }
}
