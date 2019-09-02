import _ from 'lodash'
import {
  Element, isObjectType, PrimitiveTypes, Values, ObjectType, isPrimitiveType, isInstanceElement,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import { SETTINGS_METADATA_TYPE } from '../constants'
import { bpCase } from '../transformer'

const transformPrimitive = (val: string, primitive: PrimitiveTypes):
  string | boolean | number | null | undefined => {
  // Salesforce returns nulls as objects like { $: { 'xsi:nil': 'true' } }
  // our key name transform replaces the '$' with an empty string and ':' with '_'
  if (_.isObject(val) && _.get(val, ['', 'xsi_nil']) === 'true') {
    return null
  }
  switch (primitive) {
    case PrimitiveTypes.NUMBER:
      return Number(val)
    case PrimitiveTypes.BOOLEAN:
      return val.toLowerCase() === 'true'
    case PrimitiveTypes.STRING:
      if (val.length === 0) {
        return undefined
      }
      return val
    default:
      return val
  }
}

const transform = (obj: Values, type: ObjectType, strict = true): Values | undefined => {
  const result = _(obj).mapValues((value, key) => {
    // we get lists of empty strings that we would like to filter out
    if (_.isArray(value) && _.isEmpty(value.filter(v => !_.isEmpty(v)))) {
      return undefined
    }
    // we get empty strings that we would like to filter out, will filter non string cases too.
    if (_.isEmpty(value)) {
      return undefined
    }

    const field = type.fields[key]
    if (field !== undefined) {
      const fieldType = field.type
      if (isObjectType(fieldType)) {
        return _.isArray(value)
          ? value.map(v => transform(v, fieldType, strict))
            .filter(v => !_.isEmpty(v))
          : transform(value, fieldType, strict)
      }
      if (isPrimitiveType(fieldType)) {
        return _.isArray(value)
          ? value.map(v => transformPrimitive(v, fieldType.primitive))
            .filter(v => !_.isArrayLike(v) || !_.isEmpty(v))
          : transformPrimitive(value, fieldType.primitive)
      }
    }
    // We are not returning the value if it's not fit the type definition.
    // We saw cases where we got for jsforce values empty values in unexpected
    // format for example:
    // "layoutColumns":["","",""] where layoutColumns suppose to be list of object
    // with LayoutItem and reserve fields.
    // return undefined
    // We are not strict for salesforce Settings type as type definition is empty
    // and each Setting looks different
    if (strict) {
      return undefined
    }
    return value
  }).omitBy(_.isUndefined)
    .value()
  return _.isEmpty(result) ? undefined : result
}


/**
 * Convert types of values in instance elements to match the expected types according to the
 * instance type definition.
 */
const filterCreator: FilterCreator = () => ({
  /**
   * Upon discover, convert all instance values to their correct type according to the
   * type definitions
   *
   * @param client SFDC client
   * @param elements the already discoverd elements
   */
  onDiscover: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .filter(instance => isObjectType(instance.type))
      .forEach(instance => {
        // Settings have no type fields so their conversion is non-strict
        const strict = instance.type.elemID.name !== bpCase(SETTINGS_METADATA_TYPE)
        instance.value = transform(instance.value, instance.type as ObjectType, strict) || {}
      })
  },
})

export default filterCreator
