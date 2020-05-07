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
import { exists, readTextFile, replaceContents, mkdirp, rm, rename } from '@salto-io/file'
import { collections } from '@salto-io/lowerdash'
import { flattenElementStr } from '@salto-io/adapter-utils'
import { serialize, deserialize } from '../../serializer/elements'
import State from '../state'

const { makeArray } = collections.array

const log = logger(module)

export const STATE_EXTENSION = '.jsonl'

type StateData = {
  elements: ElementMap
  // The date of the last fetch
  servicesUpdateDate: Record<string, Date>
}

export const localState = (filePath: string): State => {
  let innerStateData: Promise<StateData>
  let dirty = false
  let currentFilePath = filePath

  const loadFromFile = async (): Promise<StateData> => {
    const text = await exists(currentFilePath) ? await readTextFile(currentFilePath) : undefined
    if (text === undefined) {
      return { elements: {}, servicesUpdateDate: {} }
    }
    const [elementsData, updateDateData] = text.split(EOL)
    const deserializedElements = (await deserialize(elementsData)).map(flattenElementStr)
    const elements = _.keyBy(deserializedElements, e => e.elemID.getFullName())
    const servicesUpdateDate = updateDateData
      ? _.mapValues(JSON.parse(updateDateData), dateStr => new Date(dateStr))
      : {}
    log.debug(`loaded state [#elements=${_.size(elements)}]`)
    return { elements, servicesUpdateDate }
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
    rename: async (name: string): Promise<void> => {
      const newFilePath = path.join(path.dirname(currentFilePath), `${name}${STATE_EXTENSION}`)
      await rename(currentFilePath, newFilePath)
      currentFilePath = newFilePath
    },
    override: async (element: Element | Element[]): Promise<void> => {
      const elements = makeArray(element)
      const newServices = _(elements).map(e => e.elemID.adapter)
        .uniq()
        .filter(adapter => adapter !== GLOBAL_ADAPTER)
        .value()
      const data = await stateData()
      data.elements = _.keyBy(elements, e => e.elemID.getFullName())
      data.servicesUpdateDate = {
        ...data.servicesUpdateDate,
        ...newServices.reduce((acc, service) => {
          acc[service] = new Date(Date.now())
          return acc
        }, {} as Record<string, Date>),
      }

      dirty = true
    },
    flush: async (): Promise<void> => {
      if (!dirty) {
        return
      }
      const { elements: elementsMap, servicesUpdateDate } = (await stateData())
      const elements = Object.values(elementsMap)
      const elementsString = serialize(Object.values(elements))
      const dateString = JSON.stringify(servicesUpdateDate)
      const stateText = [elementsString, dateString].join(EOL)
      await mkdirp(path.dirname(currentFilePath))
      await replaceContents(currentFilePath, stateText)
      log.debug(`finish flushing state [#elements=${Object.values(elements).length}]`)
    },
    clear: async (): Promise<void> => {
      await rm(filePath)
    },
    getServicesUpdateDates: async (): Promise<Record<string, Date>> => (await stateData())
      .servicesUpdateDate,
    existingServices: async (): Promise<string[]> => _.keys((await stateData()).servicesUpdateDate),
  }
}
