/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import {
  ElemID, Element, isObjectType, Field, Values, Value, ObjectType, isInstanceElement,
  isListType, ListType, isElement,
} from '@salto-io/adapter-api'
import { resolvePath } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import hardcodedListsData from './hardcoded_lists.json'

type OrderFunc = (value: Value) => number
export type UnorderedList = {
  elemId: ElemID
  orderBy: string | string[] | OrderFunc
}

const fieldsToSort: ReadonlyArray<UnorderedList> = [
  {
    elemId: new ElemID(SALESFORCE, 'CleanDataService', 'field', 'cleanRules'),
    orderBy: 'developerName',
  },
  {
    elemId: new ElemID(SALESFORCE, 'CleanRule', 'field', 'fieldMappings'),
    orderBy: 'developerName',
  },
  {
    elemId: new ElemID(SALESFORCE, 'FieldMapping', 'field', 'fieldMappingRows'),
    orderBy: 'fieldName',
  },
  {
    elemId: new ElemID(SALESFORCE, 'FieldMappingRow', 'field', 'fieldMappingFields'),
    orderBy: 'dataServiceField',
  },
  {
    elemId: new ElemID(SALESFORCE, 'DuplicateRule', 'field', 'duplicateRuleMatchRules'),
    orderBy: 'matchingRule',
  },
  {
    elemId: new ElemID(SALESFORCE, 'DuplicateRuleMatchRule', 'field', 'objectMapping'),
    orderBy: ['inputObject', 'outputObject'],
  },
  {
    elemId: new ElemID(SALESFORCE, 'ObjectMapping', 'field', 'mappingFields'),
    orderBy: ['inputField', 'outputField'],
  },
  {
    elemId: new ElemID(SALESFORCE, 'BusinessProcess', 'field', 'values'),
    orderBy: 'fullName',
  },
  {
    elemId: new ElemID(SALESFORCE, 'PlatformActionList', 'field', 'platformActionListItems'),
    orderBy: val => Number(val.sortOrder),
  },
  {
    elemId: new ElemID(SALESFORCE, 'QuickActionList', 'field', 'quickActionListItems'),
    orderBy: 'quickActionName',
  },
]

const annotationsToSort: ReadonlyArray<UnorderedList> = [
  {
    elemId: new ElemID(SALESFORCE, 'MacroInstruction', 'field', 'Target', 'valueSet'),
    orderBy: 'fullName',
  },
]

// This method iterate on types and corresponding values and run innerChange
// on every "node".
const applyRecursive = (type: ObjectType, value: Values,
  innerChange: (field: Field, value: Value) => Value): void => {
  if (!value) return
  Object.keys(type.fields).forEach(key => {
    if (value[key] === undefined) return
    value[key] = innerChange(type.fields[key], value[key])
    const fieldType = type.fields[key].type
    if (!isListType(fieldType) && !isObjectType(fieldType)) return
    const actualFieldType = isListType(fieldType) ? fieldType.innerType : fieldType
    if (isObjectType(actualFieldType)) {
      if (_.isArray(value[key])) {
        value[key].forEach((val: Values) => applyRecursive(actualFieldType, val, innerChange))
      } else {
        applyRecursive(actualFieldType, value[key], innerChange)
      }
    }
  })
}

const markListRecursively = (
  type: ObjectType,
  values: Values,
): void => {
  // Mark all lists as ListType
  const markList = (field: Field, value: Value): Value => {
    if (_.isArray(value) && !isListType(field.type)) {
      // This assumes Salesforce does not have list of lists fields
      field.type = new ListType(field.type)
    }
    return value
  }
  applyRecursive(type, values, markList)
}

const castListRecursively = (
  type: ObjectType,
  values: Values,
  unorderedLists: ReadonlyArray<UnorderedList> = [],
): void => {
  const listOrders = _.fromPairs(
    unorderedLists.map(sortDef => [sortDef.elemId.getFullName(), sortDef.orderBy]),
  )
  // Cast all lists to list
  const castLists = (field: Field, value: Value): Value => {
    if (isListType(field.type) && !_.isArray(value)) {
      return [value]
    }
    // We get from sfdc api list with empty strings for empty object (possibly jsforce issue)
    if (isListType(field.type) && _.isArray(value) && _.isEmpty(value.filter(v => !_.isEmpty(v)))) {
      return []
    }

    const orderBy = listOrders[field.elemID.getFullName()]
    return orderBy ? _.orderBy(value, orderBy) : value
  }
  applyRecursive(type, values, castLists)
}

const markHardcodedLists = (
  type: ObjectType,
  knownListIds: Set<string>,
): void => _.values(type.fields).filter(f => knownListIds.has(f.elemID.getFullName())).forEach(
  f => {
    if (!isListType(f.type)) {
      f.type = new ListType(f.type)
    }
  }
)

const sortAnnotations = (type: ObjectType,
  unorderedLists: ReadonlyArray<UnorderedList> = []): void => {
  unorderedLists.forEach(({ elemId, orderBy }) => {
    const parentId = elemId.createParentID()
    const parent = resolvePath(type, parentId)
    const parentAnnotations = isElement(parent) ? parent.annotations : parent
    const annotationValue = _.get(parentAnnotations, elemId.name)
    if (annotationValue === undefined) return
    const sortedAnnotation = orderBy ? _.orderBy(annotationValue, orderBy) : annotationValue
    _.set(parentAnnotations, elemId.name, sortedAnnotation)
  })
}

export const convertList = (type: ObjectType, values: Values): void => {
  markListRecursively(type, values)
  castListRecursively(type, values)
}

/**
 * Mark list fields as lists if there is any instance that has a list value in the field,
 * or if the list field is explicitly hardcoded as list.
 * Unfortunately it seems like this is the only way to know if a field is a list or a single value
 * in the Salesforce API.
 * After marking all fields as lists we also convert all values that should be lists to a list
 * This step is needed because the API never returns lists of length 1
 */
export const makeFilter = (
  unorderedListFields: ReadonlyArray<UnorderedList>,
  unorderedListAnnotations: ReadonlyArray<UnorderedList>,
  hardcodedLists: ReadonlyArray<string>
): FilterCreator => () => ({
  /**
   * Upon fetch, mark all list fields as list fields in all fetched types
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const instances = elements
      .filter(isInstanceElement)
      .filter(inst => isObjectType(inst.type))
    const objectTypes = elements.filter(isObjectType)

    const knownListIds = new Set(
      [...hardcodedLists, ...unorderedListFields.map(sortDef => sortDef.elemId.getFullName())]
    )

    objectTypes.forEach(t => markHardcodedLists(t, knownListIds))
    instances.forEach(inst => markListRecursively(inst.type, inst.value))
    instances.forEach(inst => castListRecursively(inst.type, inst.value, unorderedListFields))
    objectTypes.forEach(t => sortAnnotations(t, unorderedListAnnotations))
  },
})

export default makeFilter(fieldsToSort, annotationsToSort, hardcodedListsData)
