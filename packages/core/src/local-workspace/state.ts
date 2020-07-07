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
import { exists, readTextFile, replaceContents, mkdirp, rm, rename } from '@salto-io/file'
import { flattenElementStr, safeJsonStringify } from '@salto-io/adapter-utils'
import { serialization, pathIndex, state } from '@salto-io/workspace'

const { serialize, deserialize } = serialization

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'

const deserializedPathIndex = (
  data: string
): pathIndex.PathIndex => new pathIndex.PathIndex(JSON.parse(data))
const serializedPathIndex = (index: pathIndex.PathIndex): string => (
  safeJsonStringify(Array.from(index.entries()))
)
export const localState = (filePath: string): state.State => {
  let innerStateData: Promise<state.StateData>
  let dirty = false
  let currentFilePath = filePath

  const loadFromFile = async (): Promise<state.StateData> => {
    const text = await exists(currentFilePath) ? await readTextFile(currentFilePath) : undefined
    if (text === undefined) {
      return { elements: {}, servicesUpdateDate: {}, pathIndex: new pathIndex.PathIndex() }
    }
    const [elementsData, updateDateData, pathIndexData] = text.split(EOL)
    const deserializedElements = (await deserialize(elementsData)).map(flattenElementStr)
    const elements = _.keyBy(deserializedElements, e => e.elemID.getFullName())
    const index = pathIndexData
      ? deserializedPathIndex(pathIndexData)
      : new pathIndex.PathIndex()
    const servicesUpdateDate = updateDateData
      ? _.mapValues(JSON.parse(updateDateData), dateStr => new Date(dateStr))
      : {}
    log.debug(`loaded state [#elements=${_.size(elements)}]`)
    return { elements, servicesUpdateDate, pathIndex: index }
  }

  const stateData = (): Promise<state.StateData> => {
    if (innerStateData === undefined) {
      innerStateData = loadFromFile()
    }
    return innerStateData
  }
  const inMemState = state.buildInMemState(stateData())

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
      const newFilePath = path.join(path.dirname(currentFilePath), `${name}${STATE_EXTENSION}`)
      await rename(currentFilePath, newFilePath)
      currentFilePath = newFilePath
    },
    flush: async (): Promise<void> => {
      if (!dirty) {
        return
      }
      const { elements: elementsMap, servicesUpdateDate, pathIndex: index } = (await stateData())
      const elements = Object.values(elementsMap)
      const elementsString = serialize(Object.values(elements))
      const dateString = safeJsonStringify(servicesUpdateDate)
      const pathIndexString = serializedPathIndex(index)
      const stateText = [elementsString, dateString, pathIndexString].join(EOL)
      await mkdirp(path.dirname(currentFilePath))
      await replaceContents(currentFilePath, stateText)
      log.debug(`finish flushing state [#elements=${Object.values(elements).length}]`)
    },
    clear: async (): Promise<void> => {
      await rm(filePath)
    },
  }
}
