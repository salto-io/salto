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
import { Element, ElemID, ElementMap, GLOBAL_ADAPTER } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { flattenElementStr } from '@salto-io/adapter-utils'
import { exists, readTextFile, replaceContents, mkdirp } from '../../file'
import { serialize, deserialize } from '../../serializer/elements'
import State from '../state'

const { makeArray } = collections.array

const log = logger(module)

type StateData = {
  elements: ElementMap
  // The date of the last fetch
  updateDate: Date | undefined
}

export const localState = (filePath: string): State => {
  let innerStateData: Promise<StateData>
  let dirty = false

  const loadFromFile = async (): Promise<StateData> => {
    const text = await exists(filePath) ? await readTextFile(filePath) : undefined
    if (text === undefined) {
      return { elements: {}, updateDate: undefined }
    }
    const [elementsData, updateDateData] = text.split(EOL)
    const deserializedElements = deserialize(elementsData).map(flattenElementStr)
    const elements = _.keyBy(deserializedElements, e => e.elemID.getFullName())
    const updateDate = updateDateData ? new Date(updateDateData) : undefined
    log.debug(`loaded state [#elements=${elements.length}]`)
    return { elements, updateDate }
  }

  const stateData = (): Promise<StateData> => {
    if (innerStateData === undefined) {
      innerStateData = loadFromFile()
    }
    return innerStateData
  }

  return {
    getAll: async (): Promise<Element[]> => Object.values((await stateData()).elements),
    list: async (): Promise<ElemID[]> =>
      Object.keys((await stateData()).elements).map(n => ElemID.fromFullName(n)),
    get: async (id: ElemID): Promise<Element> => ((await stateData()).elements[id.getFullName()]),
    set: async (element: Element | Element []): Promise<void> => {
      makeArray(element).forEach(async e => {
        (await stateData()).elements[e.elemID.getFullName()] = e
      })
      dirty = true
    },
    remove: async (id: ElemID | ElemID[]): Promise<void> => {
      makeArray(id).forEach(async i => {
        delete (await stateData()).elements[i.getFullName()]
      })
      dirty = true
    },
    override: async (element: Element | Element[]): Promise<void> => {
      const newElements = _.keyBy(makeArray(element), e => e.elemID.getFullName())
      const data = await stateData()
      data.elements = newElements
      data.updateDate = new Date(Date.now())
      dirty = true
    },
    flush: async (): Promise<void> => {
      if (!dirty) {
        return
      }
      const { elements: elementsMap, updateDate } = (await stateData())
      const elements = Object.values(elementsMap)
      const elementsString = serialize(Object.values(elements))
      const dateString = updateDate === undefined ? '' : `${EOL}${updateDate.toISOString()}`
      const stateText = `${elementsString}${dateString}`
      await mkdirp(path.dirname(filePath))
      await replaceContents(filePath, stateText)
      log.debug(`finish flushing state [#elements=${Object.values(elements).length}]`)
    },
    getUpdateDate: async (): Promise<Date | undefined> => (await stateData()).updateDate,
    existingServices: async (): Promise<string[]> => _((await stateData()).elements)
      .map(e => e.elemID.adapter)
      .uniq()
      .filter(adapter => adapter !== GLOBAL_ADAPTER)
      .value(),
  }
}
