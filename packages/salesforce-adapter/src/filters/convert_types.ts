import {
  Element, isObjectType, ObjectType,
  isInstanceElement, transform,
} from 'adapter-api'
import { FilterCreator } from '../filter'


/**
 * Convert types of values in instance elements to match the expected types according to the
 * instance type definition.
 */
const filterCreator: FilterCreator = () => ({
  /**
   * Upon fetch, convert all instance values to their correct type according to the
   * type definitions
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => isObjectType(instance.type))
      .forEach(instance => {
        instance.value = transform(instance.value, instance.type as ObjectType) || {}
      })
  },
})

export default filterCreator
