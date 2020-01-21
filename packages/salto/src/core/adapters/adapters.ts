import _ from 'lodash'
import {
  ObjectType, Adapter, ElemIdGetter, InstanceElement,
} from 'adapter-api'
import adapterCreators from './creators'

export const getAdaptersConfigType = (
  names: string[]
): Record<string, ObjectType> => {
  const relevantAdapterCreators = _.pick(adapterCreators, names)
  return _.mapValues(relevantAdapterCreators, creator => creator.configType)
}

export const initAdapters = (
  credentials: Record<string, InstanceElement | undefined>,
  getElemIdFunc?: ElemIdGetter,
): Record<string, Adapter> =>
  _.mapValues(
    credentials, (creds, adapter) => {
      if (!creds) {
        throw new Error(`${adapter} is not logged in.\n\nPlease login and try again.`)
      }
      const creator = adapterCreators[adapter]
      if (!creator) {
        throw new Error(`${adapter} adapter is not registered.`)
      }
      return creator.create({ config: creds, getElemIdFunc })
    }
  )
