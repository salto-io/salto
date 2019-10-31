import _ from 'lodash'
import {
  Element, isObjectType, Field, Values, Value, ObjectType, isInstanceElement,
} from 'adapter-api'
import { FilterCreator } from '../filter'

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
    // This method iterate on types and corresponding values and run innerChange
    // on every "node".
    const applyRecursive = (type: ObjectType, value: Values,
      innerChange: (field: Field, value: Value) => Value): Value => {
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

    // First mark all lists as isList=true
    const markList = (field: Field, value: Value): Value => {
      if (_.isArray(value)) {
        field.isList = true
      }
      return value
    }
    elements.filter(isInstanceElement).forEach(instnace =>
      applyRecursive(instnace.type as ObjectType, instnace.value, markList))

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
    elements.filter(isInstanceElement).forEach(instnace =>
      applyRecursive(instnace.type as ObjectType, instnace.value, castLists))
  },
})

export default filter
