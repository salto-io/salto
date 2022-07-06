/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { exists, readTextFile, mkdirp, rm, rename, readZipFile, replaceContents, generateZipString } from '@salto-io/file'
import { flattenElementStr, safeJsonStringify } from '@salto-io/adapter-utils'
import { serialization, pathIndex, state, remoteMap, staticFiles } from '@salto-io/workspace'
import { hash, collections, promises } from '@salto-io/lowerdash'
import origGlob from 'glob'
import semver from 'semver'
import { promisify } from 'util'

import { version } from '../generated/version.json'

const { awu } = collections.asynciterable

const { serialize, deserialize } = serialization
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

const readFromPaths = async (paths: string[]): Promise<string[][]> => {
  const elementsData: string[] = []
  const updateDateData: string[] = []
  const pathIndexData: string[] = []
  const versions: string[] = []
  // TODO fix?
  const readResults = await Promise.all(paths.map(async (p: string) =>
    ((await exists(p)) ? readZipFile(p) : undefined)))
  readResults.forEach(readResult => {
    if (readResult) {
      const [readElementsData, readUpdateDateData, readPathIndexData, versionInFile] = [
        ...readResult.split(EOL), '[]', '[]', '[]', '[]']
      elementsData.push(readElementsData)
      updateDateData.push(readUpdateDateData)
      pathIndexData.push(readPathIndexData)
      if (versionInFile !== '[]') {
        versions.push(versionInFile)
      }
    }
  })
  return [elementsData, updateDateData, pathIndexData, versions]
}

const deserializeAndFlatten = async (elementsJSON: string): Promise<Element[]> => ((
  await deserialize(elementsJSON)
) as Element[]).map(flattenElementStr)

type ContentsAndHash = { contents: [string, string][]; hash: string }

export const localState = (
  filePrefix: string,
  envName: string,
  remoteMapCreator: remoteMap.RemoteMapCreator,
  staticFilesSource: staticFiles.StateStaticFilesSource,
  persistent = true
): state.State => {
  let dirty = false
  let contentsAndHash: ContentsAndHash | undefined
  let pathToClean = ''
  let currentFilePrefix = filePrefix

  const syncQuickAccessStateData = async ({
    stateData, filePaths, newHash,
  }: {
    stateData: state.StateData
    filePaths: string[]
    newHash: string
  }): Promise<void> => {
    const [elementsData, updateDateData, pathIndexData, versions] = await readFromPaths(filePaths)
    const deserializedElements = awu(elementsData).flatMap(deserializeAndFlatten)
    await stateData.elements.clear()
    await stateData.elements.setAll(awu(deserializedElements))
    await stateData.pathIndex.clear()
    await stateData.pathIndex.setAll(
      pathIndexData ? pathIndex.deserializedPathsIndex(pathIndexData) : []
    )
    const updateDatesByAccount = _.mapValues(
      updateDateData
        .map(entry => (entry ? JSON.parse(entry) : {}))
        .filter(entry => !_.isEmpty(entry))
        .reduce((entry1, entry2) => Object.assign(entry1, entry2), {}) as Record<string, string>,
      dateStr => new Date(dateStr)
    )
    await getUpdateDate(stateData)?.clear()
    await getUpdateDate(stateData)?.setAll(awu(
      Object.entries(updateDatesByAccount).map(([key, value]) => ({ key, value }))
    ))
    const currentVersion = semver.minSatisfying(versions, '*') ?? undefined
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
      await syncQuickAccessStateData({
        stateData: quickAccessStateData,
        filePaths,
        newHash: stateFilesHash,
      })
    }
    return quickAccessStateData
  }

  const setDirty = (): void => {
    dirty = true
    contentsAndHash = undefined
  }

  const inMemState = state.buildInMemState(loadStateData)

  const createStateTextPerAccount = async (): Promise<Record<string, string>> => {
    const elements = await awu(await inMemState.getAll()).toArray()
    const elementsByAccount = _.groupBy(elements, element => element.elemID.adapter)
    const accountToElementStrings = await promises.object.mapValuesAsync(
      elementsByAccount,
      accountElements => serialize(accountElements),
    )
    const accountToDates = await inMemState.getAccountsUpdateDates()
    const accountToPathIndex = pathIndex.serializePathIndexByAccount(
      await awu((await inMemState.getPathIndex()).entries()).toArray()
    )
    log.debug(`finished dumping state text [#elements=${elements.length}]`)
    return _.mapValues(accountToElementStrings, (accountElements, account) =>
      [accountElements || '[]', safeJsonStringify({ [account]: accountToDates[account] } || {}),
        accountToPathIndex[account] || '[]', version].join(EOL))
  }
  const getContentAndHash = async (): Promise<ContentsAndHash> => {
    if (contentsAndHash === undefined) {
      const stateTextPerAccount = await createStateTextPerAccount()
      const contents = await awu(Object.keys(stateTextPerAccount))
        .map(async account => [
          `${currentFilePrefix}.${account}${ZIPPED_STATE_EXTENSION}`,
          await generateZipString(stateTextPerAccount[account]),
        ] as [string, string]).toArray()
      contentsAndHash = {
        contents,
        hash: getHashFromContent(contents.map(e => e[1])),
      }
    }
    return contentsAndHash
  }

  const calculateHashImpl = async (): Promise<void> => {
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
        return
      }
      await mkdirp(path.dirname(currentFilePrefix))
      if (pathToClean !== '') {
        await rm(pathToClean)
      }
      const filePathToContent = (await getContentAndHash()).contents
      await awu(filePathToContent).forEach(f => replaceContents(...f))
      await inMemState.setVersion(version)
      await calculateHashImpl()
      await inMemState.flush()
      await staticFilesSource.flush()
      dirty = false
      log.debug('finish flushing state')
    },
    getHash: async (): Promise<string | undefined> => inMemState.getHash(),
    calculateHash: calculateHashImpl,
    clear: async (): Promise<void> => {
      const stateFiles = await findStateFiles(currentFilePrefix)
      await inMemState.clear()
      await Promise.all(stateFiles.map(filename => rm(filename)))
      setDirty()
    },
  }
}
