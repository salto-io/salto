import _ from 'lodash'
import {
  Element, isObjectType, PrimitiveTypes, Values, ObjectType, isPrimitiveType, isInstanceElement,
  Type,
} from 'adapter-api'
import { isArray } from 'util'
import { FilterCreator } from '../filter'
import { SETTINGS_METADATA_TYPE } from '../constants'
import { bpCase } from '../transformer'

type Value = string | boolean | number | null | undefined
const transformPrimitive = (val: string, primitive: PrimitiveTypes): Value => {
  // Salesforce returns nulls as objects like { $: { 'xsi:nil': 'true' } }
  // our key name transform replaces the '$' with an empty string and ':' with '_'
  if (_.isObject(val) && _.get(val, ['', 'xsi_nil']) === 'true') {
    // We transform null to undefined as currently we don't support null in Salto language
    // and the undefined values are omitted later in the code
    return undefined
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

// In case we have restricted values list and current value is not in the list
// we check if the value can be index of the values list.
// Notice that this function is called on the discovery output of the adapter and
// will not change user input.
// This tries to solve a real validation error we saw.
const transformEnum = (val: string, annotations: Values, primitive: PrimitiveTypes): Value => {
  const values = annotations[Type.VALUES]
  const index = Number(val)

  const isString = (): boolean => (primitive === PrimitiveTypes.STRING)
  const isRestrictedValues = (): boolean =>
    (annotations[Type.RESTRICTION] && annotations[Type.RESTRICTION][Type.ENFORCE_VALUE])
  const isInValueList = (): boolean =>
    (values === undefined || !isArray(values) || values.includes(val))

  // eslint-disable-next-line no-restricted-globals
  return (isString() && isRestrictedValues() && !isInValueList() && !isNaN(index))
    ? values[Number(val)]
    : undefined
}

const transformPrimitiveType = (v: string, annotations: Values,
  primitive: PrimitiveTypes): Value =>
  transformEnum(v, annotations, primitive) || transformPrimitive(v, primitive)


export const transform = (obj: Values, type: ObjectType, strict = true): Values | undefined => {
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
          ? value.map(v => transformPrimitiveType(v, field.annotations, fieldType.primitive))
            .filter(v => !_.isArrayLike(v) || !_.isEmpty(v))
          : transformPrimitiveType(value, field.annotations, fieldType.primitive)
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
