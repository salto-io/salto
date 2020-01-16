import _ from 'lodash'
import {
  ElemID, Element, isObjectType, Field, Values, Value, ObjectType, isInstanceElement,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'

type OrderFunc = (value: Value) => number
export type UnorderedList = {
  fieldId: ElemID
  orderBy: string | string[] | OrderFunc
}

const allListsToSort: ReadonlyArray<UnorderedList> = [
  {
    fieldId: new ElemID(SALESFORCE, 'CleanDataService', 'field', 'cleanRules'),
    orderBy: 'developerName',
  },
  {
    fieldId: new ElemID(SALESFORCE, 'CleanRule', 'field', 'fieldMappings'),
    orderBy: 'developerName',
  },
  {
    fieldId: new ElemID(SALESFORCE, 'FieldMapping', 'field', 'fieldMappingRows'),
    orderBy: 'fieldName',
  },
  {
    fieldId: new ElemID(SALESFORCE, 'FieldMappingRow', 'field', 'fieldMappingFields'),
    orderBy: 'dataServiceField',
  },
  {
    fieldId: new ElemID(SALESFORCE, 'DuplicateRule', 'field', 'duplicateRuleMatchRules'),
    orderBy: 'matchingRule',
  },
  {
    fieldId: new ElemID(SALESFORCE, 'DuplicateRuleMatchRule', 'field', 'objectMapping'),
    orderBy: ['inputObject', 'outputObject'],
  },
  {
    fieldId: new ElemID(SALESFORCE, 'ObjectMapping', 'field', 'mappingFields'),
    orderBy: ['inputField', 'outputField'],
  },
  {
    fieldId: new ElemID(SALESFORCE, 'BusinessProcess', 'field', 'values'),
    orderBy: 'fullName',
  },
  {
    fieldId: new ElemID(SALESFORCE, 'PlatformActionList', 'field', 'platformActionListItems'),
    orderBy: val => Number(val.sortOrder),
  },
  {
    fieldId: new ElemID(SALESFORCE, 'QuickActionList', 'field', 'quickActionListItems'),
    orderBy: 'quickActionName',
  },
]


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

const markListRecursivly = (
  type: ObjectType,
  values: Values,
  knownListIds = new Set<string>(),
): void => {
  // Mark all lists as isList=true
  const markList = (field: Field, value: Value): Value => {
    if (_.isArray(value) || knownListIds.has(field.elemID.getFullName())) {
      field.isList = true
    }
    return value
  }
  applyRecursive(type, values, markList)
}

const castListRecursivly = (
  type: ObjectType,
  values: Values,
  unorderedLists: ReadonlyArray<UnorderedList> = [],
): void => {
  const listOrders = _.fromPairs(
    unorderedLists.map(sortDef => [sortDef.fieldId.getFullName(), sortDef.orderBy]),
  )
  // Cast all lists to list
  const castLists = (field: Field, value: Value): Value => {
    if (field.isList && !_.isArray(value)) {
      return [value]
    }
    // We get from sfdc api list with empty strings for empty object (possibly jsforce issue)
    if (field.isList && _.isArray(value) && _.isEmpty(value.filter(v => !_.isEmpty(v)))) {
      return []
    }
    const orderBy = listOrders[field.elemID.getFullName()]
    return orderBy ? _.orderBy(value, orderBy) : value
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
export const makeFilter = (unorderedLists: ReadonlyArray<UnorderedList>): FilterCreator => () => ({
  /**
   * Upon fetch, mark all list fields as list fields in all fetched types
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const instances = elements
      .filter(isInstanceElement)
      .filter(inst => isObjectType(inst.type))

    const knownListIds = new Set(
      unorderedLists.map(sortDef => sortDef.fieldId.getFullName()),
    )
    instances.forEach(inst => markListRecursivly(inst.type, inst.value, knownListIds))
    instances.forEach(inst => castListRecursivly(inst.type, inst.value, unorderedLists))
  },
})

export default makeFilter(allListsToSort)
