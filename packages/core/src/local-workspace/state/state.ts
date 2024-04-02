/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { EOL } from 'os'
import _ from 'lodash'
import path from 'path'
import { Readable } from 'stream'
import { chain } from 'stream-chain'
import { parser } from 'stream-json/jsonl/Parser'
import getStream from 'get-stream'
import { createGunzip } from 'zlib'
import { constants as bufferConstants } from 'buffer'
import { DetailedChange, Element, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { mkdirp, createGZipWriteStream } from '@salto-io/file'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { serialization, pathIndex, state, remoteMap, staticFiles, StateConfig } from '@salto-io/workspace'
import { hash, collections, promises, serialize, types } from '@salto-io/lowerdash'
import semver from 'semver'

import {
  ContentAndHash,
  createFileStateContentProvider,
  createS3StateContentProvider,
  getHashFromHashes,
  NamedStream,
  StateContentProvider,
} from './content_providers'
import { version } from '../../generated/version.json'
import { getLocalStoragePath } from '../../app_config'
import { CORE_FLAGS, getCoreFlagBool } from '../../core/flags'

const { awu } = collections.asynciterable
const { serializeStream, deserializeParsed } = serialization
const { toMD5 } = hash

const log = logger(module)

// a single entry in the path index, [elemid, filepath[] ] - based on the types defined in workspace/path_index.ts
type PathEntry = [string, string[][]]
type ParsedState = {
  elements: Element[]
  accounts: string[]
  pathIndices: PathEntry[]
  versions: string[]
}

type DeprecatedParsedState = {
  updateDates: Record<string, string>[]
}

const parsedStateKeys: types.TypeKeysEnum<ParsedState & DeprecatedParsedState> = {
  elements: 'elements',
  accounts: 'accounts',
  pathIndices: 'pathIndices',
  versions: 'versions',
  updateDates: 'updateDates',
}

const elementsStreamSerializer = serialize.createStreamSerializer({
  maxLineLength: bufferConstants.MAX_STRING_LENGTH,
  wrapWithKey: parsedStateKeys.elements,
})

const pathIndicesStreamSerializer = serialize.createStreamSerializer({
  maxLineLength: bufferConstants.MAX_STRING_LENGTH,
  wrapWithKey: parsedStateKeys.pathIndices,
})

export const parseStateContent = async (contentStreams: AsyncIterable<NamedStream>): Promise<ParsedState> => {
  let elements: unknown[] = []
  const res: Omit<ParsedState, 'elements'> = {
    accounts: [],
    pathIndices: [],
    versions: [],
  }

  const updateWithParsedStateData = (data: Partial<ParsedState & DeprecatedParsedState>): void => {
    if (data.versions !== undefined) {
      res.versions = res.versions.concat(data.versions)
    }
    if (data.accounts !== undefined) {
      res.accounts = res.accounts.concat(data.accounts)
    }
    if (data.elements !== undefined) {
      elements = elements.concat(data.elements)
    }
    if (data.pathIndices !== undefined) {
      res.pathIndices = res.pathIndices.concat(data.pathIndices)
    }
    if (data.updateDates !== undefined) {
      // use the deprecated update dates to get the accounts
      res.accounts = res.accounts.concat(data.updateDates.flatMap(Object.keys))
    }
  }

  await awu(contentStreams).forEach(async ({ name, stream }) =>
    getStream(
      chain([
        stream,
        createGunzip(),
        parser({ checkErrors: true }),
        ({ key, value }) => {
          if (key === 0) {
            // line 1 - serialized elements, e.g.
            //   [{"elemID":{...},"annotations":{...}},{"elemID":{...},"annotations":{...}},...]
            if (!_.isEmpty(value)) {
              updateWithParsedStateData({ elements: value })
            }
          } else if (key === 1) {
            // line 2 - update dates
            //   {"dummy":"2023-01-09T15:57:59.322Z"}
            if (!_.isEmpty(value)) {
              updateWithParsedStateData({ updateDates: [value] })
            }
          } else if (key === 2) {
            // line 3 - path index, e.g.
            //   [["dummy.aaa",[["dummy","Types","aaa"]]],["dummy.aaa.instance.bbb",[["dummy","Records","aaa","bbb"]]]]
            if (!_.isEmpty(value)) {
              updateWithParsedStateData({ pathIndices: value })
            }
          } else if (key === 3) {
            // line 4 - version, e.g.
            //   "0.1.2"
            if (!_.isEmpty(value)) {
              updateWithParsedStateData({ versions: [value] })
            }
          } else if (_.isPlainObject(value)) {
            updateWithParsedStateData(value)
            const unknownKeys = Object.keys(_.omit(value, Object.values(parsedStateKeys)))
            if (unknownKeys.length > 0) {
              log.error('found unexpected entries in state file %s - keys %s. ignoring', name, unknownKeys.join(','))
            }
          } else {
            log.error('found unexpected entry in state file %s - key %s. ignoring', name, key)
          }
        },
      ]),
    ),
  )
  return { ...res, elements: await deserializeParsed(elements) }
}

export const getStateContentProvider = (
  workspaceId: string,
  stateConfig: StateConfig = { provider: 'file' },
): StateContentProvider => {
  switch (stateConfig.provider) {
    case 'file': {
      const localStorageDir = stateConfig.options?.file?.localStorageDir ?? getLocalStoragePath(workspaceId)
      return createFileStateContentProvider(localStorageDir)
    }
    case 's3': {
      const options = stateConfig.options?.s3
      if (options === undefined || options.bucket === undefined) {
        throw new Error('Missing key "options.s3.bucket" in workspace state configuration')
      }
      return createS3StateContentProvider({ workspaceId, options })
    }
    default:
      throw new Error(`Unsupported state provider ${stateConfig.provider}`)
  }
}

export const localState = (
  filePrefix: string,
  envName: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  contentProvider: StateContentProvider,
  staticFilesSource?: staticFiles.StateStaticFilesSource,
  persistent = true,
): state.State => {
  let dirty = false
  let cacheDirty = false
  let contentsAndHash: Promise<ContentAndHash[]> | undefined
  let currentFilePrefix = filePrefix
  let currentContentProvider = contentProvider

  const currentStaticFilesSource = (): staticFiles.StateStaticFilesSource =>
    staticFilesSource ?? currentContentProvider.staticFilesSource

  const setDirty = (): void => {
    dirty = true
    contentsAndHash = undefined
  }

  const syncQuickAccessStateData = async ({
    stateData,
    filePaths,
    newHash,
  }: {
    stateData: state.StateData
    filePaths: string[]
    newHash: string
  }): Promise<void> => {
    const res = await parseStateContent(currentContentProvider.readContents(filePaths))
    await stateData.elements.clear()
    await stateData.elements.setAll(res.elements)
    await stateData.pathIndex.clear()
    await stateData.pathIndex.setAll(pathIndex.loadPathIndex(res.pathIndices))
    const accounts = res.accounts ?? []
    const stateAccounts = stateData.accounts
    if (stateAccounts !== undefined) {
      stateAccounts.push(...accounts)
    }
    const currentVersion = semver.minSatisfying(res.versions, '*') ?? undefined
    if (currentVersion) {
      await stateData.saltoMetadata.set('version', currentVersion)
    }
    await stateData.saltoMetadata.set('hash', newHash)
  }

  const loadStateData = async (): Promise<state.StateData> => {
    const quickAccessStateData = await state.buildStateData(
      envName,
      remoteMapCreator,
      currentStaticFilesSource(),
      persistent,
    )
    const filePaths = await currentContentProvider.findStateFiles(currentFilePrefix)
    const stateFilesHash = await currentContentProvider.getHash(filePaths)
    const quickAccessHash = (await quickAccessStateData.saltoMetadata.get('hash')) ?? toMD5(safeJsonStringify([]))
    if (quickAccessHash !== stateFilesHash) {
      log.debug(
        'found different hash - loading state data (quickAccessHash=%s stateFilesHash=%s)',
        quickAccessHash,
        stateFilesHash,
      )
      await syncQuickAccessStateData({
        stateData: quickAccessStateData,
        filePaths,
        newHash: stateFilesHash,
      })
      // We updated the remote maps, we should flush them if flush is called
      // however, we should not update the state data, we should only update
      // the cache
      cacheDirty = true
    }
    return quickAccessStateData
  }

  const inMemState = state.buildInMemState(loadStateData)

  const createStateTextPerAccount = async (): Promise<Record<string, Readable>> => {
    const elements = await awu(await inMemState.getAll()).toArray()
    const elementsByAccount = _.groupBy(elements, element => element.elemID.adapter)
    const accountToElementStreams = await promises.object.mapValuesAsync(elementsByAccount, accountElements =>
      serializeStream({
        elements: _.sortBy(accountElements, element => element.elemID.getFullName()),
        streamSerializer: getCoreFlagBool(CORE_FLAGS.dumpStateWithLegacyFormat)
          ? serialize.getSerializedStream
          : elementsStreamSerializer,
      }),
    )
    const accountToPathIndex = pathIndex.serializePathIndexByAccount(
      await awu((await inMemState.getPathIndex()).entries()).toArray(),
      getCoreFlagBool(CORE_FLAGS.dumpStateWithLegacyFormat)
        ? serialize.getSerializedStream
        : pathIndicesStreamSerializer,
    )
    async function* getStateStream(account: string): AsyncIterable<string> {
      async function* yieldWithEOL(streams: AsyncIterable<string>[]): AsyncIterable<string> {
        for (const stream of streams) {
          yield* stream
          yield EOL
        }
      }
      yield* yieldWithEOL(
        getCoreFlagBool(CORE_FLAGS.dumpStateWithLegacyFormat)
          ? [
              accountToElementStreams[account],
              awu([safeJsonStringify(account)]),
              accountToPathIndex[account] || '[]',
              awu([safeJsonStringify(version)]),
            ]
          : [
              awu(['[]']), // deprecated: serialized elements
              awu(['{}']), // deprecated: update dates
              awu(['[]']), // deprecated: path indices
              awu(['""']), // deprecated: version
              awu([safeJsonStringify({ [parsedStateKeys.versions]: [version] })]),
              awu([safeJsonStringify({ [parsedStateKeys.accounts]: [account] })]),
              accountToElementStreams[account],
              accountToPathIndex[account] || safeJsonStringify({ [parsedStateKeys.pathIndices]: [] }),
            ],
      )
      log.debug(`finished dumping state text [#elements=${elements.length}]`)
    }
    return _.mapValues(accountToElementStreams, (_val, account) => {
      const iterable = getStateStream(account)
      return Readable.from(iterable)
    })
  }

  const calculateContentAndHash = async (): Promise<ContentAndHash[]> => {
    const stateTextPerAccount = await createStateTextPerAccount()
    return awu(Object.entries(stateTextPerAccount))
      .map(async ([account, fileContent]): Promise<ContentAndHash> => {
        const content = await getStream.buffer(createGZipWriteStream(fileContent))
        // We should not call toString here, but we do to maintain backwards compatibility
        // fixing this would cause the hash to change to the correct hash value, but that would
        // trigger invalidation in all caches
        const contentHash = toMD5(content.toString())
        return { account, content, contentHash }
      })
      .toArray()
  }

  const getContentAndHash = async (): Promise<ContentAndHash[]> => {
    if (contentsAndHash === undefined) {
      contentsAndHash = calculateContentAndHash()
    }
    return contentsAndHash
  }

  const calculateHashImpl = async (): Promise<void> => {
    if (!dirty) {
      // If nothing was updated we will not flush, so to keep the hash consistent with what
      // the content will end up being on disk, we should also not re-calculate the hash
      return
    }
    const finalHash = getHashFromHashes((await getContentAndHash()).map(({ contentHash }) => contentHash))
    await inMemState.setHash(finalHash)
  }

  return {
    ...inMemState,
    set: async (element: Element): Promise<void> => {
      await inMemState.set(element)
      setDirty()
    },
    remove: async (id: ElemID): Promise<void> => {
      await inMemState.remove(id)
      setDirty()
    },
    rename: async (newPrefix: string): Promise<void> => {
      await Promise.all([
        currentStaticFilesSource().rename(newPrefix),
        currentContentProvider.rename(currentFilePrefix, newPrefix),
      ])
      currentFilePrefix = newPrefix
      setDirty()
    },
    flush: async (): Promise<void> => {
      if (!dirty) {
        if (cacheDirty) {
          await inMemState.flush()
          cacheDirty = false
        }
        return
      }
      await mkdirp(path.dirname(currentFilePrefix))
      const contents = await getContentAndHash()
      const updatedHash = getHashFromHashes(contents.map(({ contentHash }) => contentHash))
      log.debug(
        'Writing state content, hash=%s, account_hashes=%o',
        updatedHash,
        Object.fromEntries(contents.map(({ account, contentHash }) => [account, contentHash])),
      )
      await currentContentProvider.writeContents(currentFilePrefix, contents)
      await inMemState.setVersion(version)
      await inMemState.setHash(updatedHash)
      await inMemState.flush()
      dirty = false
      log.debug('finished flushing state')
    },
    calculateHash: calculateHashImpl,
    clear: async (): Promise<void> => {
      await Promise.all([currentContentProvider.clear(currentFilePrefix), inMemState.clear()])
      setDirty()
    },
    updateStateFromChanges: async ({
      changes,
      unmergedElements,
      fetchAccounts,
    }: {
      changes: DetailedChange[]
      unmergedElements?: Element[]
      fetchAccounts?: string[]
    }) => {
      await inMemState.updateStateFromChanges({ changes, unmergedElements, fetchAccounts })
      setDirty()
    },
    updateConfig: async args => {
      const newProvider = getStateContentProvider(args.workspaceId, args.stateConfig)
      const contents = await getContentAndHash()

      const tempPrefix = path.join(path.dirname(currentFilePrefix), `.tmp_${path.basename(currentFilePrefix)}`)
      await newProvider.writeContents(tempPrefix, contents)

      // swap the contents from the old provider to the new one
      // note - we have to clear before we rename in case the providers use the same file names
      await currentContentProvider.clear(currentFilePrefix)
      await newProvider.rename(tempPrefix, path.basename(currentFilePrefix))

      currentContentProvider = newProvider

      await inMemState.updateConfig(args)
    },
  }
}

type LoadStateArgs = {
  workspaceId: string
  stateConfig?: StateConfig
  baseDir: string
  envName: string
  remoteMapCreator: remoteMap.RemoteMapCreator
  staticFilesSource?: staticFiles.StateStaticFilesSource
  persistent: boolean
}
export const loadState = ({
  workspaceId,
  stateConfig,
  baseDir,
  envName,
  remoteMapCreator,
  staticFilesSource,
  persistent,
}: LoadStateArgs): state.State =>
  localState(
    baseDir,
    envName,
    remoteMapCreator,
    getStateContentProvider(workspaceId, stateConfig),
    staticFilesSource,
    persistent,
  )
