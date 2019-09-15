import { Stream } from 'stream'
import { InstanceElement, ObjectType, Element } from './elements'

export interface Adapter {
  discover(): Promise<Element[]>
  add(element: Element): Promise<Element>
  remove(element: Element): Promise<void>
  update(before: Element, after: Element): Promise<Element>
  getInstancesOfType(type: ObjectType): AsyncIterable<InstanceElement[]>
  importInstancesOfType(type: ObjectType, data: Stream): Promise<void>
}

export type AdapterCreator = {
  create: (opts: { config: InstanceElement }) => Adapter
  configType: ObjectType
}
