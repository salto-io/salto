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
import { exists, readTextFile, mkdirp, rm, rename, readZipFile, replaceContents, generateZipBuffer } from '@salto-io/file'
import { flattenElementStr, safeJsonStringify } from '@salto-io/adapter-utils'
import { serialization, pathIndex, state } from '@salto-io/workspace'
import { hash } from '@salto-io/lowerdash'

const { serialize, deserialize } = serialization
const { toMD5 } = hash

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'
export const ZIPPED_STATE_EXTENSION = '.jsonl.zip'
export const INNER_FILENAME = 'state.jsonl'

export const localState = (filePath: string): state.State => {
  let dirty = false
  let currentFilePath = filePath

  const loadFromFile = async (): Promise<state.StateData> => {
    let text: string | undefined
    if (await exists(currentFilePath + STATE_EXTENSION)) {
      currentFilePath += STATE_EXTENSION
      text = await readTextFile(currentFilePath)
    } else if (await exists(currentFilePath + ZIPPED_STATE_EXTENSION)) {
      currentFilePath += ZIPPED_STATE_EXTENSION
      text = await readZipFile(currentFilePath, INNER_FILENAME)
    }
    if (text === undefined) {
      currentFilePath += ZIPPED_STATE_EXTENSION
      return { elements: {}, servicesUpdateDate: {}, pathIndex: new pathIndex.PathIndex() }
    }
    const [elementsData, updateDateData, pathIndexData] = text.split(EOL)
    const deserializedElements = (await deserialize(elementsData)).map(flattenElementStr)
    const elements = _.keyBy(deserializedElements, e => e.elemID.getFullName())
    const index = pathIndexData
      ? pathIndex.deserializedPathIndex(pathIndexData)
      : new pathIndex.PathIndex()
    const servicesUpdateDate = updateDateData
      ? _.mapValues(JSON.parse(updateDateData), dateStr => new Date(dateStr))
      : {}
    log.debug(`loaded state [#elements=${_.size(elements)}]`)
    return { elements, servicesUpdateDate, pathIndex: index }
  }

  const inMemState = state.buildInMemState(loadFromFile)

  const getStateText = async (): Promise<string> => {
    const elements = await inMemState.getAll()
    const elementsString = serialize(elements)
    const dateString = safeJsonStringify(await inMemState.getServicesUpdateDates())
    const pathIndexString = pathIndex.serializedPathIndex(await inMemState.getPathIndex())
    log.debug(`finished dumping state text [#elements=${elements.length}]`)
    return [elementsString, dateString, pathIndexString].join(EOL)
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
    rename: async (name: string): Promise<void> => {
      const newFilePath = path.join(path.dirname(currentFilePath), `${name}${ZIPPED_STATE_EXTENSION}`)
      await rename(currentFilePath, newFilePath)
      currentFilePath = newFilePath
    },
    flush: async (): Promise<void> => {
      if (!dirty) {
        return
      }
      if (currentFilePath.endsWith(STATE_EXTENSION)) {
        const newFilePath = currentFilePath.replace(STATE_EXTENSION, ZIPPED_STATE_EXTENSION)
        await rename(currentFilePath, newFilePath)
        currentFilePath = newFilePath
      }
      const elements = await inMemState.getAll()
      const elementsString = serialize(elements)
      const dateString = safeJsonStringify(await inMemState.getServicesUpdateDates())
      const pathIndexString = pathIndex.serializedPathIndex(await inMemState.getPathIndex())
      const stateText = [elementsString, dateString, pathIndexString].join(EOL)
      await mkdirp(path.dirname(currentFilePath))
      await replaceContents(currentFilePath, await generateZipBuffer(INNER_FILENAME, stateText))
      log.debug('finish flushing state')
    },
    getHash: async (): Promise<string> => {
      const stateText = await getStateText()
      return toMD5(stateText)
    },
    clear: async (): Promise<void> => {
      await rm(filePath)
    },
  }
}
