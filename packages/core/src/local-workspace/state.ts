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
import { strings } from '@salto-io/lowerdash'
import { EOL } from 'os'
import _ from 'lodash'
import path from 'path'
import { Element, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { exists, readTextFile, replaceContents, mkdirp, rm, rename } from '@salto-io/file'
import { flattenElementStr, safeJsonStringify } from '@salto-io/adapter-utils'
import { serialization, pathIndex, state } from '@salto-io/workspace'

const { serialize, deserialize } = serialization
const { stableCollator } = strings

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'

export const localState = (filePath: string): state.State => {
  let dirty = false
  let currentFilePath = filePath

  const loadFromFile = async (): Promise<state.StateData> => {
    const text = await exists(currentFilePath) ? await readTextFile(currentFilePath) : undefined
    if (text === undefined) {
      return { elements: {}, servicesUpdateDate: {}, pathIndex: new pathIndex.PathIndex() }
    }
    const [elementsData, updateDateData, pathIndexData] = text.split(EOL)
    const deserializedElements = (
      await log.time(() => deserialize<Element[]>(elementsData), 'state deserialization')
    ).map(flattenElementStr)
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
      const elements = await inMemState.getAll()
      const sortedElements = elements.sort(
        (e1, e2) => stableCollator.compare(e1.elemID.getFullName(), e2.elemID.getFullName())
      )
      const elementsString = log.time(
        () => serialize(sortedElements, { stable: true }),
        'state serialization',
      )
      const dateString = safeJsonStringify(await inMemState.getServicesUpdateDates())
      const pathIndexString = pathIndex.serializedPathIndex(await inMemState.getPathIndex())
      const stateText = [elementsString, dateString, pathIndexString].join(EOL)
      await mkdirp(path.dirname(currentFilePath))
      await replaceContents(currentFilePath, stateText)
      log.debug(`finish flushing state [#elements=${elements.length}]`)
    },
    clear: async (): Promise<void> => {
      await rm(filePath)
    },
  }
}
