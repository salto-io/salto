import _ from 'lodash'
import {
  Element, isObjectType, PrimitiveTypes, Values, ObjectType, isPrimitiveType, isInstanceElement,
} from 'adapter-api'
import { strings } from '@salto/lowerdash'
import { FilterCreator } from '../filter'

const { isEmptyString } = strings


type PrimitiveValue = string | boolean | number
type Value = PrimitiveValue | null | undefined
const transformPrimitive = (val: PrimitiveValue, primitive: PrimitiveTypes): Value => {
  // Salesforce returns nulls as objects like { $: { 'xsi:nil': 'true' } }
  // our key name transform replaces '$' and ':' with '_'
  if (_.isObject(val) && (_.get(val, ['_', 'xsi_nil']) === 'true'
    || _.get(val, ['', 'xsi_nil']) === 'true')) {
    // We transform null to undefined as currently we don't support null in Salto language
    // and the undefined values are omitted later in the code
    return undefined
  }
  switch (primitive) {
    case PrimitiveTypes.NUMBER:
      return Number(val)
    case PrimitiveTypes.BOOLEAN:
      return _.isBoolean(val) ? val : (val as string).toLowerCase() === 'true'
    case PrimitiveTypes.STRING:
      return val.toString().length === 0 ? undefined : val.toString()
    default:
      return val
  }
}

export const transform = (obj: Values, type: ObjectType, strict = true): Values | undefined => {
  const result = _(obj).mapValues((value, key) => {
    // we get lists of empty strings that we would like to filter out
    if (_.isArray(value) && value.every(isEmptyString)) {
      return undefined
    }
    // we get empty strings that we would like to filter out
    if (isEmptyString(value)) {
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
