/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { hash, collections, values } from '@salto-io/lowerdash'
import { parser } from '@salto-io/parser'
import { logger } from '@salto-io/logging'
import { ContentType } from '../dir_store'
import { serialize, deserialize } from '../../serializer/elements'
import { StaticFilesSource } from '../static_files'
import { RemoteMapCreator, RemoteMap } from '../remote_map'
import { ParsedNaclFile, SyncParsedNaclFile } from './parsed_nacl_file'

const log = logger(module)

const { toMD5 } = hash
const { awu } = collections.asynciterable

type FileCacheMetadata = {
  hash: string
}

type ParseResultKey = {
  filename: string
  buffer?: string
}

type CacheSources = {
  elements: RemoteMap<Element[]>
  sourceMap: RemoteMap<parser.SourceMap>
  metadata: RemoteMap<FileCacheMetadata>
  errors: RemoteMap<parser.ParseError[]>
  staticFiles: RemoteMap<string[]>
}

export type ParsedNaclFileCache = {
  flush: () => Promise<void>
  clone: () => ParsedNaclFileCache
  clear: () => Promise<void>
  rename: (name: string) => Promise<void>
  getHash: () => Promise<string | undefined>
  list: () => Promise<string[]>
  delete: (filename: string) => Promise<void>
  deleteAll: (filenames: string[]) => Promise<void>
  get(filename: string): Promise<ParsedNaclFile>
  put(filename: string, value: SyncParsedNaclFile): Promise<void>
  putAll(files: Record<string, SyncParsedNaclFile>): Promise<void>
  hasValid(key: ParseResultKey): Promise<boolean>
  getAllErrors(): Promise<parser.ParseError[]> // TEMP
}

const isMD5Equal = (cacheMD5: string, buffer?: ContentType): boolean =>
  buffer === undefined || buffer === '' ? false : hash.toMD5(buffer) === cacheMD5

const parseNaclFileFromCacheSources = (cacheSources: CacheSources, filename: string): ParsedNaclFile => ({
  filename,
  elements: () => cacheSources.elements.get(filename),
  data: {
    errors: () => cacheSources.errors.get(filename),
    staticFiles: () => cacheSources.staticFiles.get(filename),
  },
  sourceMap: () => cacheSources.sourceMap.get(filename),
})

const getRemoteMapCacheNamespace = (cacheName: string, dataType: string, fileName?: string): string =>
  fileName === undefined
    ? `parsedResultCache-${cacheName}-${dataType}`
    : `parsedResultCache-${cacheName}-${dataType}-${fileName}`

const getMetadata = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
): Promise<RemoteMap<FileCacheMetadata>> =>
  remoteMapCreator.create({
    namespace: getRemoteMapCacheNamespace(cacheName, 'metadata'),
    serialize: async (val: FileCacheMetadata) => safeJsonStringify(val),
    deserialize: data => JSON.parse(data),
    persistent,
  })

const getErrors = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  persistent: boolean,
): Promise<RemoteMap<parser.ParseError[]>> =>
  remoteMapCreator.create({
    namespace: getRemoteMapCacheNamespace(cacheName, 'errors'),
    serialize: async (errors: parser.ParseError[]) => safeJsonStringify(errors ?? []),
    deserialize: data => JSON.parse(data),
    persistent,
  })

const getCacheSources = async (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
  persistent: boolean,
): Promise<CacheSources> => ({
  metadata: await getMetadata(cacheName, remoteMapCreator, persistent),
  elements: await remoteMapCreator.create({
    namespace: getRemoteMapCacheNamespace(cacheName, 'elements'),
    serialize: async (elements: Element[]) => serialize(elements ?? [], 'keepRef'),
    deserialize: async data =>
      deserialize(data, async sf =>
        staticFilesSource.getStaticFile({ filepath: sf.filepath, encoding: sf.encoding, isTemplate: sf.isTemplate }),
      ),
    persistent,
  }),
  sourceMap: await remoteMapCreator.create({
    namespace: getRemoteMapCacheNamespace(cacheName, 'sourceMap'),
    serialize: async (sourceMap: parser.SourceMap) => safeJsonStringify(Array.from(sourceMap.entries())),
    deserialize: async data => new parser.SourceMap(JSON.parse(data)),
    persistent,
  }),
  errors: await getErrors(cacheName, remoteMapCreator, persistent),
  staticFiles: await remoteMapCreator.create({
    namespace: getRemoteMapCacheNamespace(cacheName, 'staticFiles'),
    serialize: async (val: string[]) => safeJsonStringify(val ?? []),
    deserialize: data => JSON.parse(data),
    persistent,
  }),
})

const copyAllSourcesToNewName = async (oldCacheSources: CacheSources, newCacheSources: CacheSources): Promise<void> => {
  await newCacheSources.errors.setAll(oldCacheSources.errors.entries())
  await newCacheSources.elements.setAll(oldCacheSources.elements.entries())
  await newCacheSources.metadata.setAll(oldCacheSources.metadata.entries())
  await newCacheSources.sourceMap.setAll(oldCacheSources.sourceMap.entries())
}

export const createParseResultCache = (
  cacheName: string,
  remoteMapCreator: RemoteMapCreator,
  staticFilesSource: StaticFilesSource,
  persistent: boolean,
): ParsedNaclFileCache => {
  // To allow renames
  let actualCacheName = cacheName
  let cacheSources = getCacheSources(actualCacheName, remoteMapCreator, staticFilesSource, persistent)
  let cachedHash: string | undefined
  return {
    put: async (filename: string, value: SyncParsedNaclFile): Promise<void> => {
      cachedHash = undefined
      const { metadata, errors, sourceMap, elements, staticFiles } = await cacheSources
      const fileErrors = value.data.errors()
      const currentError = await errors.get(filename)
      if (!_.isEqual(currentError ?? [], fileErrors ?? [])) {
        if (fileErrors && fileErrors.length > 0) {
          await errors.set(value.filename, fileErrors)
        } else {
          await errors.delete(value.filename)
        }
      }
      await staticFiles.set(value.filename, value.data.staticFiles())
      const sourceMapValue = value.sourceMap?.()
      if (sourceMapValue !== undefined) {
        await sourceMap.set(value.filename, sourceMapValue)
      } else {
        await sourceMap.delete(value.filename)
      }
      await elements.set(value.filename, value.elements() ?? [])
      await metadata.set(filename, { hash: hash.toMD5(value.buffer ?? '') })
    },
    putAll: async (files: Record<string, SyncParsedNaclFile>): Promise<void> => {
      const { metadata, errors, sourceMap, elements, staticFiles } = await cacheSources
      cachedHash = undefined
      const errorEntriesToAdd = awu(Object.keys(files))
        .map(async file => {
          const value = files[file].data.errors() ?? []
          return { key: file, value: _.isEqual(await errors.get(file), value) ? [] : value }
        })
        .filter(entry => entry.value.length > 0)
      const errorEntriesToDelete = awu(Object.keys(files))
        .map(async file => {
          const value = files[file].data.errors()
          if (value === undefined || value.length > 0) {
            return undefined
          }
          return _.isEmpty(await errors.get(file)) ? undefined : file
        })
        .filter(values.isDefined)
      await errors.setAll(errorEntriesToAdd)
      await errors.deleteAll(errorEntriesToDelete)
      await staticFiles.setAll(
        awu(Object.keys(files)).map(async file => ({ key: file, value: files[file].data.staticFiles() })),
      )
      await sourceMap.setAll(
        awu(Object.keys(files))
          .map(async file => {
            const fileSourceMap = files[file].sourceMap?.()
            if (fileSourceMap === undefined) {
              return undefined
            }
            return { key: file, value: fileSourceMap }
          })
          .filter(values.isDefined),
      )
      await sourceMap.deleteAll(Object.keys(files).filter(file => files[file].sourceMap?.() === undefined))
      await elements.setAll(Object.keys(files).map(file => ({ key: file, value: files[file].elements() ?? [] })))
      await metadata.setAll(
        Object.keys(files).map(file => {
          const value = files[file]
          return {
            key: file,
            value: { hash: hash.toMD5(value.buffer ?? '') },
          }
        }),
      )
    },
    hasValid: async (key: ParseResultKey): Promise<boolean> => {
      const fileMetadata = await (await cacheSources).metadata.get(key.filename)
      if (fileMetadata === undefined) {
        return false
      }
      return isMD5Equal(fileMetadata.hash, key.buffer)
    },
    getAllErrors: async (): Promise<parser.ParseError[]> =>
      (await awu((await cacheSources).errors.values()).toArray()).flat(),
    get: async (filename: string): Promise<ParsedNaclFile> => {
      const sources = await cacheSources
      return parseNaclFileFromCacheSources(sources, filename)
    },
    delete: async (filename: string): Promise<void> => {
      cachedHash = undefined
      return awu(Object.values(await cacheSources)).forEach(async source => source.delete(filename))
    },
    deleteAll: async (filenames: string[]): Promise<void> => {
      cachedHash = undefined
      await awu(Object.values(await cacheSources)).forEach(source => source.deleteAll(filenames))
    },
    getHash: async () => {
      if (!cachedHash) {
        cachedHash = ''
        await awu((await cacheSources).metadata.values()).forEach(value => {
          cachedHash += value.hash
        })
        if (!cachedHash) {
          return undefined
        }
        cachedHash = toMD5(cachedHash)
      }
      return cachedHash
    },
    list: async () => awu((await cacheSources).metadata.keys()).toArray(),
    clear: async () => {
      cachedHash = undefined
      return awu(Object.values(await cacheSources)).forEach(async source => source.clear())
    },
    rename: async (newName: string) => {
      // Clearing leftover data in sources with the same name as the new one
      // Before copying the current cache data to it
      const newCacheSources = await getCacheSources(newName, remoteMapCreator, staticFilesSource, persistent)
      await awu(Object.values(newCacheSources)).forEach(async source => source.clear())
      const oldCacheSources = await cacheSources
      await copyAllSourcesToNewName(oldCacheSources, newCacheSources)
      await awu(Object.values(oldCacheSources)).forEach(async source => source.clear())
      actualCacheName = newName
      cacheSources = Promise.resolve(newCacheSources)
    },
    flush: async () => {
      if (!persistent) {
        throw new Error('can not flush an non persistent parsed nacl file cache')
      }
      await awu(Object.values(await cacheSources)).forEach(source => source.flush())

      // clear deprecated referenced index
      const referencedIndex = await remoteMapCreator.create({
        namespace: getRemoteMapCacheNamespace(cacheName, 'referenced'),
        serialize: async (val: string[]) => safeJsonStringify(val ?? []),
        deserialize: data => JSON.parse(data),
        persistent,
      })
      if (!(await referencedIndex.isEmpty())) {
        log.debug('going to clear entries of deprecated index referenced')
        await referencedIndex.clear()
        await referencedIndex.flush()
      }
    },
    clone: (): ParsedNaclFileCache =>
      createParseResultCache(cacheName, remoteMapCreator, staticFilesSource.clone(), persistent),
  }
}
