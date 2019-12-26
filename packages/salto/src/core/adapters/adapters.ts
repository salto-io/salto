import _ from 'lodash'
import {
  InstanceElement, ObjectType, Adapter, ElemIdGetter, isInstanceElement,
} from 'adapter-api'
import { promises } from '@salto/lowerdash'
import adapterCreators from './creators'

export const loginAdapters = async (
  configs: Readonly<InstanceElement[]>,
  fillConfig: (t: ObjectType) => Promise<InstanceElement>,
  names: string[],
  force = false
): Promise<InstanceElement[]> => {
  const relevantAdapterCreators = _.pick(adapterCreators, names)
  const newConfigsPromises = Object.values(relevantAdapterCreators).map(async creator => {
    let config = configs.find(e => e.elemID.adapter === creator.configType.elemID.adapter)
    if (force || !config) {
      config = await fillConfig(creator.configType)
      return config
    }
    return undefined
  })
  const newConfigs = (await Promise.all(newConfigsPromises)).filter(
    val => isInstanceElement(val)
  ) as InstanceElement[]
  return newConfigs
}

export const initAdapters = async (
  configs: Readonly<InstanceElement[]>,
  names: string[],
  getElemIdFunc?: ElemIdGetter,
): Promise<Record<string, Adapter>> => {
  const relevantAdapterCreators = _.pick(adapterCreators, names)
  const adapterPromises: Record<string, Promise<Adapter>> = _.mapValues(
    relevantAdapterCreators, async creator => {
      const config = configs.find(e => e.elemID.adapter === creator.configType.elemID.adapter)
      if (!config) {
        throw new Error(`${creator.configType.elemID.adapter} is not logged in`)
      }
      return creator.create({ config, getElemIdFunc })
    }
  )
  const adapters = await promises.object.resolveValues(adapterPromises)
  return adapters
}
