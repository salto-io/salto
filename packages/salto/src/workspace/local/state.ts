import _ from 'lodash'
import { Element, ElemID, ElementMap } from 'adapter-api'
import { logger } from '@salto/logging'
import { decorators, collections } from '@salto/lowerdash'
import { readTextFile, replaceContents } from '../../file'
import { serialize, deserialize } from '../../serializer/elements'
import { ElementsDataSource } from '../elements_data_source'

const { makeArray } = collections.array

const log = logger(module)

export default class LocalState implements ElementsDataSource {
  private innerElements?: ElementMap
  constructor(private filePath: string) {}

  private static load = decorators.wrapMethodWith(
    // eslint-disable-next-line prefer-arrow-callback
    async function load(this: LocalState, originalMethod: decorators.OriginalCall):
    Promise<unknown> {
      const read = async (): Promise<Element[]> => {
        const text = await readTextFile(this.filePath)
        return text === undefined ? [] : deserialize(text)
      }

      if (this.innerElements === undefined) {
        const elements = await read()
        this.innerElements = _.keyBy(elements, e => e.elemID.getFullName()) || {}
        log.debug(`loaded state [#elements=${_.size(this.elements)}]`)
      }
      return originalMethod.call()
    }
  )

  private get elements(): ElementMap {
    return this.innerElements || {}
  }

  @LocalState.load
  async getAll(): Promise<Element[]> {
    return Object.values(this.elements)
  }

  @LocalState.load
  async list(): Promise<ElemID[]> {
    return Object.keys(this.elements).map(n => ElemID.fromFullName(n))
  }

  @LocalState.load
  async get(id: ElemID): Promise<Element> {
    return this.elements[id.getFullName()]
  }

  @LocalState.load
  async set(element: Element | Element []): Promise<void> {
    makeArray(element).forEach(e => { this.elements[e.elemID.getFullName()] = e })
  }

  @LocalState.load
  async remove(id: ElemID | ElemID[]): Promise<void> {
    makeArray(id).forEach(i => { delete this.elements[i.getFullName()] })
  }

  async flush(): Promise<void> {
    if (this.innerElements === undefined) {
      return
    }
    const buffer = serialize(Object.values(this.elements))
    await replaceContents(this.filePath, buffer)
    log.debug(`finish flushing state [#elements=${_.size(this.elements)}]`)
  }
}
