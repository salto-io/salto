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
import { EOL } from 'os'
import _ from 'lodash'
import path from 'path'
import { Element, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { exists, readTextFile, mkdirp, rm, rename, readZipFile, replaceContents, generateZipString } from '@salto-io/file'
import { flattenElementStr, safeJsonStringify } from '@salto-io/adapter-utils'
import { serialization, pathIndex, state, remoteMap, RemoteElementSource } from '@salto-io/workspace'
import { hash, collections } from '@salto-io/lowerdash'
import origGlob from 'glob'
import semver from 'semver'
import { promisify } from 'util'

import { adapterCreators } from '../core/adapters'


import { version } from '../generated/version.json'

const { awu } = collections.asynciterable

const { serialize, deserialize, deserializeSingleElement } = serialization
const { toMD5 } = hash

const glob = promisify(origGlob)

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'
export const ZIPPED_STATE_EXTENSION = '.jsonl.zip'

const supportedAdapters = Object.keys(adapterCreators)
const filePathGlob = (currentFilePrefix: string): string => (
  `${currentFilePrefix}.@(${supportedAdapters.join('|')})${ZIPPED_STATE_EXTENSION}`
)
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

export const localState = (
  filePrefix: string,
  envName: string,
  remoteMapCreator: remoteMap.RemoteMapCreator
): state.State => {
  let dirty = false
  let pathToClean = ''
  let currentFilePrefix = filePrefix

  const createStateNamespace = (namespace: string): string =>
    `state-${envName}-${namespace}`

  const createStateData = async (): Promise<state.StateData> => {
    const elements = new RemoteElementSource(await remoteMapCreator<Element>({
      namespace: createStateNamespace('elements'),
      serialize: elem => serialize([elem]),
      // TODO: I don't think we should add reviver here but I need to think about it more
      deserialize: deserializeSingleElement,
    }))
    const index = await remoteMapCreator<pathIndex.Path[]>({
      namespace: createStateNamespace('path_index'),
      serialize: paths => safeJsonStringify(paths),
      deserialize: async data => JSON.parse(data),
    })
    const servicesUpdateDate = await remoteMapCreator<Date>({
      namespace: createStateNamespace('service_update_date'),
      serialize: date => date.toJSON(),
      deserialize: async data => new Date(data),
    })
    const saltoVersion = await remoteMapCreator<string, 'version'>({
      namespace: createStateNamespace('salto_metadata'),
      serialize: data => data,
      deserialize: async data => data,
    })
    return { elements, servicesUpdateDate, pathIndex: index, saltoVersion }
  }

  const flushStateData = async ({
    stateData, elementsData, pathIndexData, updateDateData, versions,
  }: {
    stateData: state.StateData
    elementsData: string[]
    pathIndexData: string[]
    updateDateData: string[]
    versions: string[]
  }): Promise<void> => {
    const deserializedElements = _.flatten(await Promise.all(
      elementsData.map((d: string) => deserializeAndFlatten(d))
    ))
    await stateData.elements.clear()
    await stateData.elements.setAll(awu(deserializedElements))
    await stateData.pathIndex.clear()
    await stateData.pathIndex.setAll(
      pathIndexData ? pathIndex.deserializedPathsIndex(pathIndexData) : []
    )
    const updateDatesByService = _.mapValues(
      updateDateData
        .map(entry => (entry ? JSON.parse(entry) : {}))
        .filter(entry => !_.isEmpty(entry))
        .reduce((entry1, entry2) => Object.assign(entry1, entry2), {}) as Record<string, string>,
      dateStr => new Date(dateStr)
    )
    await stateData.servicesUpdateDate.clear()
    await stateData.servicesUpdateDate.setAll(awu(
      Object.entries(updateDatesByService).map(([key, value]) => ({ key, value }))
    ))
    const currentVersion = semver.minSatisfying(versions, '*') || undefined
    if (currentVersion) {
      await stateData.saltoVersion.set('version', currentVersion)
    }
  }

  const loadFromFile = async (): Promise<state.StateData> => {
    let elementsData: string[] = []
    let updateDateData: string[] = []
    let pathIndexData: string[] = []
    let versions: string[] = []
    const currentFilePaths = await glob(filePathGlob(currentFilePrefix))
    if (currentFilePaths.length > 0) {
      [elementsData, updateDateData, pathIndexData,
        versions] = await readFromPaths(currentFilePaths)
    } else if (await exists(`${filePrefix}${ZIPPED_STATE_EXTENSION}`)) {
      pathToClean = `${filePrefix}${ZIPPED_STATE_EXTENSION}`;
      [elementsData, updateDateData, pathIndexData,
        versions] = await readFromPaths([`${filePrefix}${ZIPPED_STATE_EXTENSION}`])
    } else if (await exists(filePrefix + STATE_EXTENSION)) {
      pathToClean = filePrefix + STATE_EXTENSION;
      [elementsData[0], updateDateData[0], pathIndexData[0]] = [...(
        await readTextFile(pathToClean)).split(EOL), '[]', '[]', '[]']
      versions = [version]
    }
    const stateWasUpdated = async (): Promise<boolean> => {
      const hashRemoteMap = await remoteMapCreator<string>({
        namespace: createStateNamespace('hash'),
        serialize: data => data,
        deserialize: async data => data,
      })
      const currentHash = await hashRemoteMap.get('value')
      return toMD5([elementsData, pathIndexData, updateDateData, versions].join(EOL))
        !== currentHash
    }
    const stateData = await createStateData()
    if (stateWasUpdated()) {
      await flushStateData({ stateData, elementsData, pathIndexData, updateDateData, versions })
    }
    return stateData
  }

  const inMemState = state.buildInMemState(loadFromFile)

  const createStateTextPerService = async (): Promise<Record<string, string>> => {
    const elements = await awu(await inMemState.getAll()).toArray()
    const elementsByService = _.groupBy(elements, element => element.elemID.adapter)
    const serviceToElementStrings = _.mapValues(elementsByService,
      serviceElements => serialize(serviceElements))
    const serviceToDates = await inMemState.getServicesUpdateDates()
    const serviceToPathIndex = pathIndex.serializePathIndexByService(
      await awu((await inMemState.getPathIndex()).entries()).toArray()
    )
    log.debug(`finished dumping state text [#elements=${elements.length}]`)
    return _.mapValues(serviceToElementStrings, (serviceElements, service) =>
      [serviceElements || '[]', safeJsonStringify({ [service]: serviceToDates[service] } || {}),
        serviceToPathIndex[service] || '[]', version].join(EOL))
  }

  return {
    ...inMemState,
    set: async (element: Element): Promise<void> => {
      await inMemState.set(element)
      dirty = true
    },
    remove: async (id: ElemID): Promise<void> => {
      await inMemState.remove(id)
      dirty = true
    },
    override: async (element: AsyncIterable<Element>, services?: string[]): Promise<void> => {
      await inMemState.override(element, services)
      dirty = true
    },
    overridePathIndex: async (unmergedElements: Element[]): Promise<void> => {
      await inMemState.overridePathIndex(unmergedElements)
      dirty = true
    },
    updatePathIndex: async (unmergedElements: Element[], servicesToMaintain: string[]):
     Promise<void> => {
      await inMemState.updatePathIndex(unmergedElements, servicesToMaintain)
      dirty = true
    },
    rename: async (newPrefix: string): Promise<void> => {
      const stateFiles = await findStateFiles(currentFilePrefix)
      await Promise.all(
        stateFiles.map(async filename => {
          const newFilePath = filename.replace(currentFilePrefix,
            path.join(path.dirname(currentFilePrefix), newPrefix))
          await rename(filename, newFilePath)
        })
      )
      currentFilePrefix = newPrefix
    },
    flush: async (): Promise<void> => {
      if (!dirty && pathToClean === '') {
        return
      }
      await mkdirp(path.dirname(currentFilePrefix))
      const stateTextPerService = await createStateTextPerService()
      await Promise.all(Object.keys(stateTextPerService).map(async service => (
        replaceContents(`${currentFilePrefix}.${service}${ZIPPED_STATE_EXTENSION}`,
          await generateZipString(stateTextPerService[service]))
      )))
      if (pathToClean !== '') {
        await rm(pathToClean)
      }
      await inMemState.flush()
      log.debug('finish flushing state')
    },
    getHash: async (): Promise<string> => {
      const stateText = await createStateTextPerService()
      return toMD5(safeJsonStringify(_.mapValues(stateText, toMD5)))
    },
    clear: async (): Promise<void> => {
      const stateFiles = await findStateFiles(currentFilePrefix)
      await inMemState.clear()
      await Promise.all(stateFiles.map(filename => rm(filename)))
    },
  }
}
