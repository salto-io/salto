import SalesforceAdapter from 'salesforce-adapter'
import {
  InstanceElement, Element, ObjectType, isInstanceElement, ElemID,
} from 'adapter-api'

export interface Adapter {
  getConfigType(): ObjectType
  init(config: InstanceElement): void
  discover(): Promise<Element[]>
  add(element: ObjectType): Promise<ObjectType>
  remove(element: Element): Promise<void>
  update(before: ObjectType, after: ObjectType): Promise<ObjectType>
}

export const adapters: Record<string, Adapter> = { salesforce: new SalesforceAdapter() }

export const init = async (elements: Element[], fillConfig: (t: ObjectType) =>
  Promise<InstanceElement>): Promise<InstanceElement[]> => {
  const configs = elements.filter(element => isInstanceElement(element)
    && element.type.elemID.name === ElemID.CONFIG_INSTANCE_NAME) as InstanceElement[]
  const newConfigs: InstanceElement[] = []

  Object.values(adapters).forEach(async adapter => {
    let config = configs.find(e => e.type.elemID.name === adapter.getConfigType().elemID.name)
    if (!config) {
      config = await fillConfig(adapter.getConfigType())
      newConfigs.push(config)
    }
    adapter.init(config)
  })

  return Promise.resolve(newConfigs)
}
