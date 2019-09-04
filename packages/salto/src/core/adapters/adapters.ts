import _ from 'lodash'
import {
  InstanceElement, Element, ObjectType, isInstanceElement, ElemID, Adapter,
} from 'adapter-api'
import adapterCreators from './creators'

const initAdapters = async (
  elements: Element[],
  fillConfig: (t: ObjectType) => Promise<InstanceElement>
): Promise<[Record<string, Adapter>, InstanceElement[]]> => {
  const configs = elements.filter(
    e => isInstanceElement(e) && e.elemID.name === ElemID.CONFIG_INSTANCE_NAME
  ) as InstanceElement[]

  const newConfigs: InstanceElement[] = []

  const findConfig = async (configType: ObjectType): Promise<InstanceElement> => {
    let config = configs.find(e => e.type.elemID.adapter === configType.elemID.adapter)
    if (!config) {
      config = await fillConfig(configType)
      newConfigs.push(config)
    }
    return config
  }

  const adapterEntries = await Promise.all(
    Object.entries(adapterCreators).map(async ([adapterName, creator]) => {
      const adapter = await creator.create({ config: await findConfig(creator.configType) })
      return [adapterName, adapter]
    })
  )

  const adapters = _.fromPairs(adapterEntries)

  return [adapters, newConfigs]
}

export default initAdapters
