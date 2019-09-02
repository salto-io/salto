import _ from 'lodash'
import {
  InstanceElement, Element, ObjectType, isInstanceElement, ElemID, Adapter,
} from 'adapter-api'
import adapterCreators from './creators'

const mapValuesAsync = async <V1, V2>(
  o: Record<string, V1>, mapper: (v: V1) => Promise<V2>
): Promise<Record<string, V2>> => Promise.all(
  Object.keys(o).map(key => mapper(o[key]).then(v => [key, v]))
).then(_.fromPairs)

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

  const adapters = await mapValuesAsync(
    adapterCreators,
    async (
      { create, configType }
    ): Promise<Adapter> => create({ config: await findConfig(configType) }),
  )

  return [adapters, newConfigs]
}

export default initAdapters
