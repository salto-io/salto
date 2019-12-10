import _ from 'lodash'
import {
  InstanceElement, ObjectType, isInstanceElement, Adapter, ElemIdGetter, Element,
} from 'adapter-api'
import { promises } from '@salto/lowerdash'
import adapterCreators from './creators'

const initAdapters = async (
  elements: Readonly<Element[]>,
  fillConfig: (t: ObjectType) => Promise<InstanceElement>,
  names: string[],
  getElemIdFunc?: ElemIdGetter,):
  Promise<[Record<string, Adapter>, InstanceElement[]]> => {
  const configs = elements.filter(isInstanceElement)
    .filter(e => e.elemID.isConfig())
  const newConfigs: InstanceElement[] = []

  const findConfig = async (configType: ObjectType): Promise<InstanceElement> => {
    let config = configs.find(e => e.elemID.adapter === configType.elemID.adapter)
    if (!config) {
      config = await fillConfig(configType)
      newConfigs.push(config)
    }
    return config
  }

  const relevantAdapterCreators = _.pick(adapterCreators, names)
  const adapterPromises: Record<string, Promise<Adapter>> = _.mapValues(
    relevantAdapterCreators, async creator => {
      const config = await findConfig(creator.configType)
      return creator.create({ config, getElemIdFunc })
    }
  )

  const adapters = await promises.object.resolveValues(adapterPromises)
  return [adapters, newConfigs]
}

export default initAdapters
