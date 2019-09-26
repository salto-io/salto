import _ from 'lodash'
import {
  InstanceElement, Element, ObjectType, isInstanceElement, Adapter,
} from 'adapter-api'
import { promises } from '@salto/lowerdash'
import adapterCreators from './creators'

const initAdapters = (
  elements: ReadonlyArray<Element>,
  fillConfig: (t: ObjectType) => Promise<InstanceElement>,
): Promise<Record<string, Adapter>> => {
  const configs = elements.filter(isInstanceElement)
    .filter(e => e.elemID.isConfig())

  const findConfig = async (configType: ObjectType): Promise<InstanceElement> => {
    let config = configs.find(e => e.elemID.adapter === configType.elemID.adapter)
    if (!config) {
      config = await fillConfig(configType)
    }
    return config
  }

  const adapterPromises: Record<string, Promise<Adapter>> = _.mapValues(
    adapterCreators, async creator => {
      const config = await findConfig(creator.configType)
      return creator.create({ config })
    }
  )

  return promises.object.resolveValues(adapterPromises)
}

export default initAdapters
