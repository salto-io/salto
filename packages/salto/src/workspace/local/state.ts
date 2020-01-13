import _ from 'lodash'
import { Element, ElemID, ElementMap } from 'adapter-api'
import { logger } from '@salto/logging'
import { collections } from '@salto/lowerdash'
import { readTextFile, replaceContents } from '../../file'
import { serialize, deserialize } from '../../serializer/elements'
import { ElementsDataSource } from '../elements_data_source'

const { makeArray } = collections.array

const log = logger(module)

export default class LocalState implements ElementsDataSource {
  private innerElements?: Promise<ElementMap>
  private dirty = false

  constructor(private filePath: string) {}

  private async loadFromFile(): Promise<ElementMap> {
    const text = await readTextFile(this.filePath)
    const elements = text === undefined ? [] : deserialize(text)
    log.debug(`loaded state [#elements=${elements.length}]`)
    return _.keyBy(elements, e => e.elemID.getFullName()) || {}
  }

  private get elements(): Promise<ElementMap> {
    if (this.innerElements === undefined) {
      this.innerElements = this.loadFromFile()
    }
    return this.innerElements
  }

  async getAll(): Promise<Element[]> {
    return Object.values(await this.elements)
  }

  async list(): Promise<ElemID[]> {
    return Object.keys(await this.elements).map(n => ElemID.fromFullName(n))
  }

  async get(id: ElemID): Promise<Element> {
    return (await this.elements)[id.getFullName()]
  }

  async set(element: Element | Element []): Promise<void> {
    makeArray(element).forEach(async e => {
      (await this.elements)[e.elemID.getFullName()] = e
    })
    this.dirty = true
  }

  async remove(id: ElemID | ElemID[]): Promise<void> {
    makeArray(id).forEach(async i => {
      delete (await this.elements)[i.getFullName()]
    })
    this.dirty = true
  }

  async flush(): Promise<void> {
    if (!this.dirty) {
      return
    }
    const elements = await this.elements
    const buffer = serialize(Object.values(elements))
    await replaceContents(this.filePath, buffer)
    log.debug(`finish flushing state [#elements=${elements.length}]`)
  }
}
