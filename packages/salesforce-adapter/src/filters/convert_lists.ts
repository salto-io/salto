import _ from 'lodash'
import {
  Element, isObjectType, Field, Values, Value, ObjectType, isInstanceElement,
} from 'adapter-api'
import { FilterCreator } from '../filter'


// This method iterate on types and corresponding values and run innerChange
// on every "node".
const applyRecursive = (type: ObjectType, value: Values,
  innerChange: (field: Field, value: Value) => Value): void => {
  Object.keys(type.fields).forEach(key => {
    if (!value || !value[key]) return
    value[key] = innerChange(type.fields[key], value[key])
    const fieldType = type.fields[key].type
    if (isObjectType(fieldType)) {
      if (_.isArray(value[key])) {
        value[key].forEach((val: Values) => applyRecursive(fieldType, val, innerChange))
      } else {
        applyRecursive(fieldType, value[key], innerChange)
      }
    }
  })
}

const markListRecursivly = (type: ObjectType, values: Values): void => {
  // Mark all lists as isList=true
  const markList = (field: Field, value: Value): Value => {
    if (_.isArray(value)) {
      field.isList = true
    }
    return value
  }
  applyRecursive(type, values, markList)
}

const castListRecursivly = (type: ObjectType, values: Values): void => {
  // Cast all lists to list
  const castLists = (field: Field, value: Value): Value => {
    if (field.isList && !_.isArray(value)) {
      return [value]
    }
    // We get from sfdc api list with empty strings for empty object (possibly jsforce issue)
    if (field.isList && _.isArray(value) && _.isEmpty(value.filter(v => !_.isEmpty(v)))) {
      return []
    }
    return value
  }
  applyRecursive(type, values, castLists)
}

export const convertList = (type: ObjectType, values: Values): void => {
  markListRecursivly(type, values)
  castListRecursivly(type, values)
}


/**
 * Mark list fields as lists if there is any instance that has a list value in the field.
 * Unfortunately it seems like this is the only way to know if a field is a list or a single value
 * in the Salesforce API.
 * After marking all fields as lists we also convert all values that should be lists to a list
 * This step is needed because the API never returns lists of length 1
 */
const filter: FilterCreator = () => ({
  /**
   * Upon fetch, mark all list fields as list fields in all fetched types
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    elements.filter(isInstanceElement).forEach(instance =>
      markListRecursivly(instance.type as ObjectType, instance.value))
    elements.filter(isInstanceElement).forEach(instance =>
      castListRecursivly(instance.type as ObjectType, instance.value))
  },
})

export default filter
