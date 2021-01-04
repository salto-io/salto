/*
*                      Copyright 2021 Salto Labs Ltd.
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
  isListType, ListType, isElement, isContainerType,
} from '@salto-io/adapter-api'
import { applyRecursive, resolvePath } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { SALESFORCE, PROFILE_METADATA_TYPE } from '../constants'
import hardcodedListsData from './hardcoded_lists.json'
import { metadataType } from '../transformers/transformer'
import { metadataTypeToFieldToMapDef } from './convert_maps'

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
    elemId: new ElemID(SALESFORCE, 'LeadConvertSettings', 'field', 'objectMapping'),
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
    // maps are created synthetically and should not be converted here
    if (!isContainerType(f.type)) {
      f.type = new ListType(f.type)
    }
  }
)

const sortAnnotations = (type: ObjectType,
  unorderedLists: ReadonlyArray<UnorderedList> = []): void => {
  unorderedLists.forEach(({ elemId, orderBy }) => {
    const parentId = elemId.createParentID()
    const parent = resolvePath(type, parentId)
    const parentValues = isElement(parent) ? parent.annotations : parent
    const annotationValue = _.get(parentValues, elemId.name)
    if (annotationValue === undefined) return
    const sortedAnnotation = _.orderBy(annotationValue, orderBy)
    _.set(parentValues, elemId.name, sortedAnnotation)
  })
}

export const convertList = (type: ObjectType, values: Values): void => {
  markListRecursively(type, values)
  castListRecursively(type, values)
}

const getMapFieldIds = (types: ObjectType[], useOldProfiles?: boolean): Set<string> => {
  let objectsWithMapFields = types.filter(obj => Object.keys(metadataTypeToFieldToMapDef)
    .includes(metadataType(obj)))

  if (useOldProfiles) { // profile instance is irrelevant
    objectsWithMapFields = objectsWithMapFields.filter(
      obj => metadataType(obj) !== PROFILE_METADATA_TYPE
    )
  }

  if (objectsWithMapFields.length > 0) {
    const allObjectsFields = objectsWithMapFields.flatMap(obj => Object.values(obj.fields))

    return new Set(allObjectsFields
      .filter(f => metadataTypeToFieldToMapDef[metadataType(f.parent)] !== undefined)
      .filter(f => metadataTypeToFieldToMapDef[metadataType(f.parent)][f.name] !== undefined)
      .map(f => f.elemID.getFullName()))
  }
  return new Set()
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
): FilterCreator => ({ config }) => ({
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

    const mapFieldIds = getMapFieldIds(objectTypes, config.useOldProfiles)
    const knownListIds = new Set([
      ...hardcodedLists,
      ...unorderedListFields.map(sortDef => sortDef.elemId.getFullName()),
    ].filter(id => !mapFieldIds.has(id)))

    objectTypes.forEach(t => markHardcodedLists(t, knownListIds))
    instances.forEach(inst => markListRecursively(inst.type, inst.value))
    instances.forEach(inst => castListRecursively(inst.type, inst.value, unorderedListFields))
    objectTypes.forEach(t => sortAnnotations(t, unorderedListAnnotations))
  },
})

export default makeFilter(fieldsToSort, annotationsToSort, hardcodedListsData)
