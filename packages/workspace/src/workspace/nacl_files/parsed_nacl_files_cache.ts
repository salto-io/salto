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
import { Value, Element, ElemID } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { hash, collections, types } from '@salto-io/lowerdash'
import { SourceMap, SourceRange } from '../../parser'
import { ContentType } from '../dir_store'
import { serialize, deserialize } from '../../serializer/elements'
import { StaticFilesSource } from '../static_files'
import { RemoteMapCreator, RemoteMap } from '../remote_map'
import { RemoteElementSource } from '../elements_source'
import { ParsedNaclFile, ParsedNaclFileDataKeys } from './parsed_nacl_file'

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

type FileSources = {
  elementsSource: RemoteElementSource
  data: RemoteMap<Value, ParsedNaclFileDataKeys>
  sourceMap: RemoteMap<SourceRange[]>
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
  hasValid(key: ParseResultKey): Promise<boolean>
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

const parseResultFromFileSources = async (
  filename: string,
  fileSources: FileSources
): Promise<ParsedNaclFile> => {
  const sourceMapEntries: [string, SourceRange[]][] = (
    await awu(fileSources.sourceMap.entries())
      .toArray()).map(e => [e.key, e.value])
  return ({
    filename,
    elements: fileSources.elementsSource,
    data: fileSources.data,
    sourceMap: new SourceMap(
      sourceMapEntries
    ),
  })
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

const getUnflushedDeletedFiles = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<RemoteMap<boolean>> => (
  remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'deleted-files'),
    serialize: (val: boolean) => safeJsonStringify(val),
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

const getDeletedFilesList = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
): Promise<string[]> => {
  const deletedFiles = await getUnflushedDeletedFiles(cacheName, remoteMapCreator)
  return awu(deletedFiles.keys()).toArray()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isParsedElemIDArray = (parsed: any): boolean =>
  Array.isArray(parsed) && parsed.every(val =>
    (val.adapter !== undefined && val.typeName !== undefined && val.idType !== undefined))

const toNamespaceApprovedStr = (str: string): string =>
  str.replace(/[\W_]+/g, '-')

const getFileSources = async (
  cacheName: string,
  fileName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<FileSources> => ({
  // This should be per element?
  elementsSource: new RemoteElementSource(await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'elements', toNamespaceApprovedStr(fileName)),
    serialize: (element: Element) => serialize([element]),
    deserialize: async data => (await deserialize(
      data,
      async sf => staticFilesSource.getStaticFile(sf.filepath, sf.encoding),
    ))[0],
  })),
  sourceMap: (await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'sourceMap', toNamespaceApprovedStr(fileName)),
    serialize: (sourceRanges: SourceRange[]) => safeJsonStringify(sourceRanges),
    deserialize: data => JSON.parse(data),
  })),
  data: (await remoteMapCreator({
    namespace: getRemoteMapCacheNamespace(cacheName, 'data', toNamespaceApprovedStr(fileName)),
    serialize: (val: Value) => safeJsonStringify(val),
    deserialize: data => {
      const parsed = JSON.parse(data)
      if (isParsedElemIDArray(parsed)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return parsed.map((e: {[key: string]: any}) =>
          (new ElemID(
            e.adapter, e.typeName, e.idType, ...(e.nameParts ?? []),
          )))
      }
      return parsed
    },
  })) as RemoteMap<Value, ParsedNaclFileDataKeys>,
})

const getAllFilesSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
  withDeleted = false,
): Promise<collections.asynciterable.AwuIterable<types.ValueOf<FileSources>>> => {
  const fileNames = [
    ...await getCacheFilesList(cacheName, remoteMapCreator),
    ...(withDeleted ? await getDeletedFilesList(cacheName, remoteMapCreator) : []),
  ]
  return awu(fileNames).flatMap(async filename =>
    Object.values(await getFileSources(
      cacheName,
      filename,
      remoteMapCreator,
      staticFilesSource
    )))
}

const copyFileSourcesToNewName = async (
  oldName: string,
  newName: string,
  filename: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<void> => {
  const oldNameSources = await getFileSources(
    oldName,
    filename,
    remoteMapCreator,
    staticFilesSource
  )
  const newNameSources = await getFileSources(
    newName,
    filename,
    remoteMapCreator,
    staticFilesSource
  )
  await newNameSources.data.setAll(oldNameSources.data.entries())
  await newNameSources.sourceMap.setAll(oldNameSources.sourceMap.entries())
  await newNameSources.elementsSource.setAll(await oldNameSources.elementsSource.getAll())
}

const copyAllSourcesToNewName = async (
  oldName: string,
  newName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<void> => {
  const oldNameFiles = await getCacheFilesList(oldName, remoteMapCreator)
  oldNameFiles.forEach(async filename =>
    copyFileSourcesToNewName(
      oldName,
      newName,
      filename,
      remoteMapCreator,
      staticFilesSource
    ))
  const oldMetadata = await getMetadata(oldName, remoteMapCreator)
  const newMetatadata = await getMetadata(newName, remoteMapCreator)
  await newMetatadata.setAll(oldMetadata.entries())
}

const clearAllSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
): Promise<void> => {
  const filesSources = await getAllFilesSources(
    cacheName,
    remoteMapCreator,
    staticFilesSource
  )
  await filesSources.forEach(async source =>
    source.clear())
  const metadata = await getMetadata(cacheName, remoteMapCreator)
  await metadata.clear()
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
      const fileSources = await getFileSources(
        actualCacheName,
        key.filename,
        remoteMapCreator,
        staticFilesSource
      )
      await fileSources.data.clear()
      await fileSources.data.setAll(value.data.entries())
      if (value.sourceMap !== undefined) {
        await fileSources.sourceMap.clear()
        await awu(value.sourceMap.entries()).forEach(async ([sourceKey, sourceRanges]) => {
          await fileSources.sourceMap.set(sourceKey, sourceRanges)
        })
      }
      // Should consider not accepting this as an elements source cause it requires clear
      await fileSources.elementsSource.clear()
      await fileSources.elementsSource.setAll(await value.elements.getAll())
      const metadata = await getMetadata(actualCacheName, remoteMapCreator)
      await metadata.set(key.filename, {
        hash: hash.toMD5(key.buffer),
        timestamp: Date.now(),
      })
    },
    hasValid: async (key: ParseResultKey): Promise<boolean> => {
      const metadata = await getMetadata(actualCacheName, remoteMapCreator)
      const fileMetadata = await metadata.get(key.filename)
      return fileMetadata !== undefined && shouldReturnCacheData(key, fileMetadata)
    },
    get: async (key: ParseResultKey, allowInvalid = false): Promise<ParsedNaclFile | undefined> => {
      const fileSources = await getFileSources(
        actualCacheName,
        key.filename,
        remoteMapCreator,
        staticFilesSource
      )
      const metadata = await getMetadata(actualCacheName, remoteMapCreator)
      const fileMetadata = await metadata.get(key.filename)
      if (fileMetadata === undefined) {
        return undefined
      }
      if (!shouldReturnCacheData(key, fileMetadata, allowInvalid)) {
        return undefined
      }
      return parseResultFromFileSources(key.filename, fileSources)
    },
    delete: async (filename: string): Promise<void> => {
      const fileSources = await getFileSources(
        actualCacheName,
        filename,
        remoteMapCreator,
        staticFilesSource
      )
      Object.values(fileSources).forEach(async source =>
        source.clear())
      const metadata = await getMetadata(actualCacheName, remoteMapCreator)
      await metadata.delete(filename)
      const deletedFiles = await getUnflushedDeletedFiles(actualCacheName, remoteMapCreator)
      await deletedFiles.set(filename, true)
    },
    list: async () => getCacheFilesList(actualCacheName, remoteMapCreator),
    clear: async () => {
      const activeFileNames = await getCacheFilesList(actualCacheName, remoteMapCreator)
      await clearAllSources(actualCacheName, remoteMapCreator, staticFilesSource)
      const deletedFiles = await getUnflushedDeletedFiles(actualCacheName, remoteMapCreator)
      const filenamesEntries = activeFileNames.map(filename =>
        ({ key: filename, value: true }))
      await deletedFiles.setAll(filenamesEntries)
    },
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
      const filesSources = await getAllFilesSources(
        actualCacheName,
        remoteMapCreator,
        staticFilesSource,
        true,
      )
      await filesSources.forEach(async source =>
        source.flush())
      const metadata = await getMetadata(actualCacheName, remoteMapCreator)
      await metadata.flush()
      const deletedFiles = await getUnflushedDeletedFiles(actualCacheName, remoteMapCreator)
      await deletedFiles.clear()
      await deletedFiles.flush()
    },
    // This is not right cause it will use the same remoteMaps
    clone: (): ParsedNaclFileCache =>
      createParseResultCache(cacheName, remoteMapCreator, staticFilesSource.clone()),
  }
}
