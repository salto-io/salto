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
import { version } from '../generated/version.json'

const { serialize, deserialize } = serialization
const { toMD5 } = hash

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'
export const ZIPPED_STATE_EXTENSION = '.jsonl.zip'

export const localState = (filePath: string): state.State => {
  let dirty = false
  let pathToClean = ''
  let currentFilePath = filePath + ZIPPED_STATE_EXTENSION

  const loadFromFile = async (): Promise<state.StateData> => {
    let text: string | undefined
    if (await exists(currentFilePath)) {
      text = await readZipFile(currentFilePath)
    } else if (await exists(filePath + STATE_EXTENSION)) {
      pathToClean = filePath + STATE_EXTENSION
      text = await readTextFile(pathToClean)
    }
    if (text === undefined) {
      return {
        elements: {},
        servicesUpdateDate: {},
        pathIndex: new pathIndex.PathIndex(),
        saltoVersion: version,
      }
    }
    const [elementsData, updateDateData, pathIndexData, versionData] = text.split(EOL)
    const deserializedElements = (await deserialize(elementsData)).map(flattenElementStr)
    const elements = _.keyBy(deserializedElements, e => e.elemID.getFullName())
    const index = pathIndexData
      ? pathIndex.deserializedPathIndex(pathIndexData)
      : new pathIndex.PathIndex()
    const servicesUpdateDate = updateDateData
      ? _.mapValues(JSON.parse(updateDateData), dateStr => new Date(dateStr))
      : {}
    log.debug(`loaded state [#elements=${_.size(elements)}]`)
    return {
      elements,
      servicesUpdateDate,
      pathIndex: index,
      saltoVersion: versionData,
    }
  }

  const inMemState = state.buildInMemState(loadFromFile)

  const createStateText = async (): Promise<string> => {
    const elements = await inMemState.getAll()
    const elementsString = serialize(elements)
    const dateString = safeJsonStringify(await inMemState.getServicesUpdateDates())
    const pathIndexString = pathIndex.serializedPathIndex(await inMemState.getPathIndex())
    log.debug(`finished dumping state text [#elements=${elements.length}]`)
    return [elementsString, dateString, pathIndexString, version].join(EOL)
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
    rename: async (name: string): Promise<void> => {
      const newFilePath = path.join(path.dirname(currentFilePath), `${name}${ZIPPED_STATE_EXTENSION}`)
      if (exists(currentFilePath)) {
        await rename(currentFilePath, newFilePath)
      } else {
        throw Error(`Rename failed. ${currentFilePath} Does not exists`)
      }
      currentFilePath = newFilePath
    },
    flush: async (): Promise<void> => {
      if (!dirty && pathToClean === '') {
        return
      }
      const stateText = await createStateText()
      await mkdirp(path.dirname(currentFilePath))
      await replaceContents(currentFilePath, await generateZipString(stateText))
      if (pathToClean !== '') {
        await rm(pathToClean)
      }
      log.debug('finish flushing state')
    },
    getHash: async (): Promise<string> => {
      const stateText = await createStateText()
      return toMD5(stateText)
    },
    clear: async (): Promise<void> => {
      await inMemState.clear()
      await rm(currentFilePath)
    },
  }
}
