import _ from 'lodash'
import {
  InstanceElement, Element, ObjectType, isInstanceElement, Adapter, ElemIdGetter,
} from 'adapter-api'
import { promises } from '@salto/lowerdash'
import adapterCreators from './creators'

const initAdapters = async (
  elements: ReadonlyArray<Element>,
  fillConfig: (t: ObjectType) => Promise<InstanceElement>,
  getElemIdFunc?: ElemIdGetter):
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

  const adapterPromises: Record<string, Promise<Adapter>> = _.mapValues(
    adapterCreators, async creator => {
      const config = await findConfig(creator.configType)
      return creator.create({ config, getElemIdFunc })
    }
  )

  const adapters = await promises.object.resolveValues(adapterPromises)

  return [adapters, newConfigs]
}

export default initAdapters
