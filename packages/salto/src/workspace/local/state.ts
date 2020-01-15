import _ from 'lodash'
import { Element, ElemID, ElementMap } from 'adapter-api'
import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import { exists, readTextFile, replaceContents } from '../../file'
import { serialize, deserialize } from '../../serializer/elements'
import State from '../state'

const { makeArray } = collections.array

const log = logger(module)

export const localState = (filePath: string): State => {
  let innerElements: Promise<ElementMap> | undefined
  let dirty = false

  const loadFromFile = async (): Promise<ElementMap> => {
    const text = await exists(filePath) ? await readTextFile(filePath) : undefined
    const elements = text === undefined ? [] : deserialize(text)
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
      makeArray(element).forEach(async e => {
        (await elements())[e.elemID.getFullName()] = e
      })
      dirty = true
    },
    remove: async (id: ElemID | ElemID[]): Promise<void> => {
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
      await replaceContents(filePath, serialize(Object.values(stateElements)))
      log.debug(`finish flushing state [#elements=${stateElements.length}]`)
    },
  }
}
