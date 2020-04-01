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
import _ from 'lodash'
import path from 'path'
import { Element, ElemID, ElementMap } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { flattenElementStr } from '@salto-io/adapter-utils'
import { exists, readTextFile, replaceContents, mkdirp, stat, Stats } from '../../file'
import { serialize, deserialize } from '../../serializer/elements'
import State from '../state'

const { makeArray } = collections.array

const log = logger(module)

export const localState = (filePath: string): State => {
  let innerElements: Promise<ElementMap> | undefined
  let lastUpdated: Date | null
  let dirty = false

  const loadFromFile = async (): Promise<ElementMap> => {
    const text = await exists(filePath) ? await readTextFile(filePath) : undefined
    const elements = text === undefined ? [] : deserialize(text).map(flattenElementStr)
    log.debug(`loaded state [#elements=${elements.length}]`)
    return _.keyBy(elements, e => e.elemID.getFullName()) || {}
  }

  const elements = (): Promise<ElementMap> => {
    if (innerElements === undefined) {
      innerElements = loadFromFile()
    }
    return innerElements as Promise<ElementMap>
  }

  return {
    getAll: async (): Promise<Element[]> => Object.values(await elements()),
    list: async (): Promise<ElemID[]> =>
      Object.keys(await elements()).map(n => ElemID.fromFullName(n)),
    get: async (id: ElemID): Promise<Element> => ((await elements())[id.getFullName()]),
    set: async (element: Element | Element []): Promise<void> => {
      lastUpdated = new Date(Date.now())
      makeArray(element).forEach(async e => {
        (await elements())[e.elemID.getFullName()] = e
      })
      dirty = true
    },
    remove: async (id: ElemID | ElemID[]): Promise<void> => {
      lastUpdated = new Date(Date.now())
      makeArray(id).forEach(async i => {
        delete (await elements())[i.getFullName()]
      })
      dirty = true
    },
    flush: async (): Promise<void> => {
      if (!dirty) {
        return
      }
      const stateElements = await elements()
      await mkdirp(path.dirname(filePath))
      await replaceContents(filePath, serialize(Object.values(stateElements)))
      log.debug(`finish flushing state [#elements=${Object.values(stateElements).length}]`)
    },
    getUpdateDate: async (): Promise<Date | null> => {
      if (lastUpdated === undefined) {
        lastUpdated = await exists(filePath) ? (await stat(filePath) as Stats).mtime : null
      }
      return lastUpdated
    },
  }
}
