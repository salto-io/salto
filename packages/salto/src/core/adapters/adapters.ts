import _ from 'lodash'
import {
  InstanceElement, ObjectType, Adapter, ElemIdGetter,
} from 'adapter-api'
import { promises } from '@salto/lowerdash'
import adapterCreators from './creators'

export type loginStatus = { configType: ObjectType; isLoggedIn: boolean }

export const getAdaptersLoginStatus = async (
  configs: Readonly<InstanceElement[]>,
  names: string[],
): Promise<Record<string, loginStatus>> => {
  const relevantAdapterCreators = _.pick(adapterCreators, names)
  const adaptersToLoggedIn = _.mapValues(relevantAdapterCreators,
    creator => ({
      configType: creator.configType,
      isLoggedIn: !!configs.find(e => e.elemID.adapter === creator.configType.elemID.adapter),
    }))
  return adaptersToLoggedIn
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
        throw new Error(`${creator.configType.elemID.adapter} is not logged in.\n\nPlease login and try again.`)
      }
      return creator.create({ config, getElemIdFunc })
    }
  )
  const adapters = await promises.object.resolveValues(adapterPromises)
  return adapters
}
