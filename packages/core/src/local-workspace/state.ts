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
import { serialization, pathIndex, state } from '@salto-io/workspace'
import { hash } from '@salto-io/lowerdash'
import glob from 'glob'
import semver from 'semver'
import { version } from '../generated/version.json'

const { serialize, deserialize } = serialization
const { toMD5 } = hash

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'
export const ZIPPED_STATE_EXTENSION = '.jsonl.zip'

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

const deserializeAndFlatten = async (elementsJSON: string): Promise<Element[]> => (
  await deserialize(elementsJSON)
).map(flattenElementStr)

const flattenStateData = async (elementsData: string[], pathIndexData: string[],
  updateDateData: string[], versions: string[]): Promise<state.StateData> => {
  const deserializedElements = _.flatten(await Promise.all(
    elementsData.map((d: string) => deserializeAndFlatten(d))
  ))
  const elements = _.keyBy(deserializedElements, e => e.elemID.getFullName())
  const index = pathIndexData ? pathIndex.deserializedPathsIndex(pathIndexData)
    : new pathIndex.PathIndex()
  const updateDatesByService = updateDateData.map(
    (entry: string) => (entry ? JSON.parse(entry) : {})
  )
  const servicesUpdateDate = _.mapValues(updateDatesByService.reduce((entry1,
    entry2) => Object.assign(entry1, entry2), {}), dateStr => new Date(dateStr))
  const saltoVersion = semver.minSatisfying(versions, '*') || undefined
  return { elements, servicesUpdateDate, pathIndex: index, saltoVersion }
}

export const localState = (filePrefix: string): state.State => {
  let dirty = false
  let pathToClean = ''
  let currentFilePrefix = filePrefix

  const loadFromFile = async (): Promise<state.StateData> => {
    let elementsData: string[] = []
    let updateDateData: string[] = []
    let pathIndexData: string[] = []
    let currentFilePaths: string[] = []
    let versions: string[] = []
    glob(`${currentFilePrefix}*${ZIPPED_STATE_EXTENSION}`, (_err: Error | null, files: string[]) => {
      currentFilePaths = files
    })
    if (currentFilePaths.length > 0) {
      [elementsData, updateDateData, pathIndexData,
        versions] = await readFromPaths(currentFilePaths)
    } else if (await exists(filePrefix + STATE_EXTENSION)) {
      pathToClean = filePrefix + STATE_EXTENSION;
      [elementsData[0], updateDateData[0], pathIndexData[0]] = [...(
        await readTextFile(pathToClean)).split(EOL), '[]', '[]', '[]']
      versions = [version]
    } else {
      return {
        elements: {},
        servicesUpdateDate: {},
        pathIndex: new pathIndex.PathIndex(),
        saltoVersion: version,
      }
    }
    const stateData = await flattenStateData(elementsData, pathIndexData, updateDateData, versions)
    log.debug(`loaded state [#elements=${_.size(stateData.elements)}]`)
    return stateData
  }

  const inMemState = state.buildInMemState(loadFromFile)

  const createStateTextPerService = async (): Promise<Record<string, string>> => {
    const elements = _.groupBy(await inMemState.getAll(), element => element.elemID.adapter)
    const serviceToElementStrings = _.mapValues(elements,
      serviceElements => serialize(serviceElements))
    const serviceToDates = await inMemState.getServicesUpdateDates()
    const serviceToPathIndex = pathIndex.serializePathIndexByService(
      await inMemState.getPathIndex()
    )
    log.debug(`finished dumping state text [#elements=${elements.length}]`)
    return _.mapValues(serviceToElementStrings, (serviceElements, service) =>
      [serviceElements || '[]', serviceToDates[service] || '{}',
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
    override: async (element: Element | Element[]): Promise<void> => {
      await inMemState.override(element)
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
      glob(`${currentFilePrefix}*${ZIPPED_STATE_EXTENSION}`, async (_err: Error | null, files: string[]) => {
        files.forEach(async filename => {
          const newFilePath = filename.replace(currentFilePrefix,
            path.join(path.dirname(currentFilePrefix), newPrefix))
          await rename(filename, newFilePath)
        })
      })
      currentFilePrefix = newPrefix
    },
    flush: async (): Promise<void> => {
      if (!dirty && pathToClean === '') {
        return
      }
      await mkdirp(path.dirname(currentFilePrefix))
      const stateTextPerService = await createStateTextPerService()
      Object.entries(stateTextPerService).forEach(async ([service, stateText]) => {
        await replaceContents(`${currentFilePrefix}.${service}${ZIPPED_STATE_EXTENSION}`,
          await generateZipString(stateText))
      })
      if (pathToClean !== '') {
        await rm(pathToClean)
      }
      log.debug('finish flushing state')
    },
    getHash: async (): Promise<string> => {
      const stateText = await createStateTextPerService()
      return toMD5(safeJsonStringify(stateText))
    },
    clear: async (): Promise<void> => {
      const existingServices = await inMemState.existingServices()
      await inMemState.clear()
      await Promise.all(existingServices.map(service => rm(`${currentFilePrefix}.${service}${ZIPPED_STATE_EXTENSION}`)))
    },
  }
}
