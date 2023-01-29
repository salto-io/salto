/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { EOL } from 'os'
import _ from 'lodash'
import path from 'path'
import { Readable } from 'stream'
import { chain } from 'stream-chain'

import { parser } from 'stream-json/jsonl/Parser'

import getStream from 'get-stream'
import { Element, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { exists, readTextFile, mkdirp, rm, rename, replaceContents, createGZipWriteStream, isOldFormatStateZipFile, readOldFormatGZipFile, createGZipReadStream } from '@salto-io/file'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { serialization, pathIndex, state, remoteMap, staticFiles } from '@salto-io/workspace'
import { hash, collections, promises, values as lowerdashValues } from '@salto-io/lowerdash'
import origGlob from 'glob'
import semver from 'semver'
import { promisify } from 'util'

import { version } from '../generated/version.json'

const { isDefined } = lowerdashValues
const { awu } = collections.asynciterable
const { serializeStream, deserializeParsed } = serialization
const { toMD5 } = hash

const glob = promisify(origGlob)

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'
export const ZIPPED_STATE_EXTENSION = '.jsonl.zip'

export const filePathGlob = (currentFilePrefix: string): string => (
  `${currentFilePrefix}.*([!.])${ZIPPED_STATE_EXTENSION}`
)

// This function is temporary for the transition to multiple services.
// Remove this when no longer used, SALTO-1661
const getUpdateDate = (data: state.StateData): remoteMap.RemoteMap<Date> => {
  if ('servicesUpdateDate' in data) {
    return data.servicesUpdateDate
  }
  return data.accountsUpdateDate
}

const findStateFiles = async (currentFilePrefix: string): Promise<string[]> => {
  const stateFiles = await glob(filePathGlob(currentFilePrefix))
  const oldStateFiles = await glob(`${currentFilePrefix}@(${ZIPPED_STATE_EXTENSION}|${STATE_EXTENSION})`)
  return [...stateFiles, ...oldStateFiles]
}

// a single entry in the path index, [elemid, filepath[] ] - based on the types defined in workspace/path_index.ts
type PathEntry = [string, string[][]]
type ParsedState = {
  elements: Element[]
  updateDates: Record<string, string>[]
  pathIndices: PathEntry[]
  versions: string[]
}

const parseFromPaths = async (
  paths: string[],
): Promise<ParsedState> => {
  const res: ParsedState = {
    elements: [],
    updateDates: [],
    pathIndices: [],
    versions: [],
  }

  // backward-compatible function for reading the state file (changed in SALTO-3149)
  const createBackwardCompatibleGZipReadStream = async (
    zipFilename: string,
  ): Promise<Readable> => {
    if (await isOldFormatStateZipFile(zipFilename)) {
      // old state file compressed with UTF encoding, with an incorrectly-serialized version row
      const data = await readOldFormatGZipFile(zipFilename) ?? ''
      // hack to fix non-jsonl format in old state file
      // (the last line which contains the version was missing quotes, e.g. 0.1.2 instead of "0.1.2")
      const dataWithNewlines = (EOL !== '\n'
        ? data.replace(EOL, '\n')
        : data)
      const lines = dataWithNewlines.split('\n')
      const updatedData = [...lines.slice(0, 3), `"${lines[3]}"`].join(EOL)

      return Readable.from(updatedData)
    }
    return createGZipReadStream(zipFilename)
  }

  const streams = (await Promise.all(
    paths.map(async (p: string) => (
      await exists(p)
        ? { filePath: p, stream: await createBackwardCompatibleGZipReadStream(p) }
        : undefined
    ))
  )).filter(isDefined)
  await awu(streams).forEach(async ({ filePath, stream }) => getStream(chain([
    stream,
    parser({ checkErrors: true }),
    async ({ key, value }) => {
      if (key === 0) {
        // line 1 - serialized elements, e.g.
        //   [{"elemID":{...},"annotations":{...}},{"elemID":{...},"annotations":{...}},...]
        res.elements = res.elements.concat(await deserializeParsed(value))
      } else if (key === 1) {
        // line 2 - update dates, e.g.
        //   {"dummy":"2023-01-09T15:57:59.322Z"}
        res.updateDates.push(value)
      } else if (key === 2) {
        // line 3 - path index, e.g.
        //   [["dummy.aaa",[["dummy","Types","aaa"]]],["dummy.aaa.instance.bbb",[["dummy","Records","aaa","bbb"]]]]
        res.pathIndices = res.pathIndices.concat(value)
      } else if (key === 3) {
        // line 4 - version, e.g.
        //   "0.1.2"
        if (!_.isEmpty(value)) {
          res.versions.push(value)
        }
      } else {
        log.error('found unexpected entry in state file %s - key %s. ignoring', filePath, key)
      }
    },
  ])))
  return res
}

type ContentsAndHash = { contents: [string, Buffer][]; hash: string }

export const localState = (
  filePrefix: string,
  envName: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  staticFilesSource: staticFiles.StateStaticFilesSource,
  persistent = true
): state.State => {
  let dirty = false
  let cacheDirty = false
  let contentsAndHash: ContentsAndHash | undefined
  let pathToClean = ''
  let currentFilePrefix = filePrefix

  const setDirty = (): void => {
    dirty = true
    contentsAndHash = undefined
  }

  const syncQuickAccessStateData = async ({
    stateData, filePaths, newHash,
  }: {
    stateData: state.StateData
    filePaths: string[]
    newHash: string
  }): Promise<void> => {
    const res = await parseFromPaths(filePaths)
    await stateData.elements.clear()
    await stateData.elements.setAll(res.elements)
    await stateData.pathIndex.clear()
    await stateData.pathIndex.setAll(pathIndex.loadPathIndex(res.pathIndices))
    const updateDatesByAccount = _.mapValues(
      res.updateDates
        .map(entry => (entry ?? {}))
        .filter(entry => !_.isEmpty(entry))
        .reduce((entry1, entry2) => Object.assign(entry1, entry2), {}) as Record<string, string>,
      dateStr => new Date(dateStr)
    )
    const stateUpdateDate = getUpdateDate(stateData)
    if (stateUpdateDate !== undefined) {
      await stateUpdateDate.clear()
      await stateUpdateDate.setAll(awu(
        Object.entries(updateDatesByAccount).map(([key, value]) => ({ key, value }))
      ))
    }
    const currentVersion = semver.minSatisfying(res.versions, '*') ?? undefined
    if (currentVersion) {
      await stateData.saltoMetadata.set('version', currentVersion)
    }
    await stateData.saltoMetadata.set('hash', newHash)
  }

  const getRelevantStateFiles = async (): Promise<string[]> => {
    const currentFilePaths = await glob(filePathGlob(currentFilePrefix))
    if (currentFilePaths.length > 0) {
      return currentFilePaths
    }
    const oldStateFilePath = `${filePrefix}${ZIPPED_STATE_EXTENSION}`
    if (await exists(oldStateFilePath)) {
      pathToClean = oldStateFilePath
      return [oldStateFilePath]
    }
    return []
  }

  const getHashFromContent = (contents: string[]): string =>
    toMD5(safeJsonStringify(contents.map(toMD5).sort()))

  const getHash = async (filePaths: string[]): Promise<string> =>
    // TODO fix?
    getHashFromContent((await Promise.all(filePaths.map(readTextFile))))

  const loadStateData = async (): Promise<state.StateData> => {
    const quickAccessStateData = await state.buildStateData(
      envName,
      remoteMapCreator,
      staticFilesSource,
      persistent,
    )
    const filePaths = await getRelevantStateFiles()
    const stateFilesHash = await getHash(filePaths)
    const quickAccessHash = (await quickAccessStateData.saltoMetadata.get('hash'))
      ?? toMD5(safeJsonStringify([]))
    if (quickAccessHash !== stateFilesHash) {
      log.debug('found different hash - loading state data (quickAccessHash=%s stateFilesHash=%s)', quickAccessHash, stateFilesHash)
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
    const accountToElementStreams = await promises.object.mapValuesAsync(
      elementsByAccount,
      accountElements => serializeStream(
        _.sortBy(accountElements, element => element.elemID.getFullName())
      ),
    )
    const accountToDates = await inMemState.getAccountsUpdateDates()
    const accountToPathIndex = pathIndex.serializePathIndexByAccount(
      await awu((await inMemState.getPathIndex()).entries()).toArray()
    )
    async function *getStateStream(account: string): AsyncIterable<string> {
      async function *yieldWithEOL(streams: AsyncIterable<string>[]): AsyncIterable<string> {
        for (const stream of streams) {
          yield* stream
          yield EOL
        }
      }
      yield* yieldWithEOL([
        accountToElementStreams[account],
        awu([safeJsonStringify({ [account]: accountToDates[account] } || {})]),
        accountToPathIndex[account] || '[]',
        awu([safeJsonStringify(version)]),
      ])
      log.debug(`finished dumping state text [#elements=${elements.length}]`)
    }
    return _.mapValues(accountToElementStreams, (_val, account) => {
      const iterable = getStateStream(account)
      return Readable.from(iterable)
    })
  }
  const getContentAndHash = async (): Promise<ContentsAndHash> => {
    if (contentsAndHash === undefined) {
      const stateTextPerAccount = await createStateTextPerAccount()
      const contents = await awu(Object.keys(stateTextPerAccount))
        .map(async (account: string): Promise<[string, Buffer]> => [
          `${currentFilePrefix}.${account}${ZIPPED_STATE_EXTENSION}`,
          await getStream.buffer(createGZipWriteStream(stateTextPerAccount[account])),
        ]).toArray()
      contentsAndHash = {
        contents,
        hash: getHashFromContent(contents.map(e => e[1].toString())),
      }
    }
    return contentsAndHash
  }

  const calculateHashImpl = async (): Promise<void> => {
    if (!dirty) {
      // If nothing was updated we will not flush, so to keep the hash consistent with what
      // the content will end up being on disk, we should also not re-calculate the hash
      return
    }
    const contentHash = contentsAndHash?.hash ?? (await getContentAndHash()).hash
    await inMemState.setHash(contentHash)
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
    override: async (element: AsyncIterable<Element>, accounts?: string[]): Promise<void> => {
      await inMemState.override(element, accounts)
      setDirty()
    },
    overridePathIndex: async (unmergedElements: Element[]): Promise<void> => {
      await inMemState.overridePathIndex(unmergedElements)
      setDirty()
    },
    updatePathIndex: async (unmergedElements: Element[], accountsToMaintain: string[]):
     Promise<void> => {
      await inMemState.updatePathIndex(unmergedElements, accountsToMaintain)
      setDirty()
    },
    rename: async (newPrefix: string): Promise<void> => {
      await staticFilesSource.rename(newPrefix)

      const stateFiles = await findStateFiles(currentFilePrefix)
      await awu(stateFiles).forEach(async filename => {
        const newFilePath = filename.replace(currentFilePrefix,
          path.join(path.dirname(currentFilePrefix), newPrefix))
        await rename(filename, newFilePath)
      })

      currentFilePrefix = newPrefix
      setDirty()
    },
    flush: async (): Promise<void> => {
      if (!dirty && pathToClean === '') {
        if (cacheDirty) {
          await inMemState.flush()
          cacheDirty = false
        }
        return
      }
      await mkdirp(path.dirname(currentFilePrefix))
      if (pathToClean !== '') {
        await rm(pathToClean)
      }
      const { contents: filePathToContent, hash: updatedHash } = await getContentAndHash()
      await awu(filePathToContent).forEach(f => replaceContents(...f))
      await inMemState.setVersion(version)
      await inMemState.setHash(updatedHash)
      await inMemState.flush()
      await staticFilesSource.flush()
      dirty = false
      log.debug('finish flushing state')
    },
    calculateHash: calculateHashImpl,
    clear: async (): Promise<void> => {
      const stateFiles = await findStateFiles(currentFilePrefix)
      await inMemState.clear()
      await Promise.all(stateFiles.map(filename => rm(filename)))
      setDirty()
    },
  }
}
