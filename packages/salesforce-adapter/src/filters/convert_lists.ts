/*
*                      Copyright 2023 Salto Labs Ltd.
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
  isListType, ListType, isElement, isContainerType, createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { applyRecursive, resolvePath } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { SALESFORCE } from '../constants'
import hardcodedListsData from './hardcoded_lists.json'
import { metadataType } from '../transformers/transformer'
import { metadataTypeToFieldToMapDef } from './convert_maps'

const { awu } = collections.asynciterable

type OrderFunc = (value: Value) => number
export type UnorderedList = {
  elemID: ElemID
  orderBy: string | string[] | OrderFunc
}

const fieldsToSort: ReadonlyArray<UnorderedList> = [
  {
    elemID: new ElemID(SALESFORCE, 'CleanDataService', 'field', 'cleanRules'),
    orderBy: 'developerName',
  },
  {
    elemID: new ElemID(SALESFORCE, 'CleanRule', 'field', 'fieldMappings'),
    orderBy: 'developerName',
  },
  {
    elemID: new ElemID(SALESFORCE, 'FieldMapping', 'field', 'fieldMappingRows'),
    orderBy: 'fieldName',
  },
  {
    elemID: new ElemID(SALESFORCE, 'FieldMappingRow', 'field', 'fieldMappingFields'),
    orderBy: 'dataServiceField',
  },
  {
    elemID: new ElemID(SALESFORCE, 'DuplicateRule', 'field', 'duplicateRuleMatchRules'),
    orderBy: 'matchingRule',
  },
  {
    elemID: new ElemID(SALESFORCE, 'DuplicateRuleMatchRule', 'field', 'objectMapping'),
    orderBy: ['inputObject', 'outputObject'],
  },
  {
    elemID: new ElemID(SALESFORCE, 'LeadConvertSettings', 'field', 'objectMapping'),
    orderBy: ['inputObject', 'outputObject'],
  },
  {
    elemID: new ElemID(SALESFORCE, 'ObjectMapping', 'field', 'mappingFields'),
    orderBy: ['inputField', 'outputField'],
  },
  {
    elemID: new ElemID(SALESFORCE, 'BusinessProcess', 'field', 'values'),
    orderBy: 'fullName',
  },
  {
    elemID: new ElemID(SALESFORCE, 'PlatformActionList', 'field', 'platformActionListItems'),
    orderBy: val => Number(val.sortOrder),
  },
  {
    elemID: new ElemID(SALESFORCE, 'QuickActionList', 'field', 'quickActionListItems'),
    orderBy: 'quickActionName',
  },
]

const annotationsToSort: ReadonlyArray<UnorderedList> = [
  {
    elemID: new ElemID(SALESFORCE, 'MacroInstruction', 'field', 'Target', 'valueSet'),
    orderBy: 'fullName',
  },
]

const markListRecursively = async (
  type: ObjectType,
  values: Values,
): Promise<void> => {
  // Mark all lists as ListType
  const markList = async (field: Field, value: Value): Promise<Value> => {
    if (_.isArray(value) && !isListType(await field.getType())) {
      // This assumes Salesforce does not have list of lists fields
      field.refType = createRefToElmWithValue(new ListType(await field.getType()))
    }
    return value
  }
  await applyRecursive(type, values, markList)
}

const castListRecursively = async (
  type: ObjectType,
  values: Values,
  unorderedLists: ReadonlyArray<UnorderedList> = [],
): Promise<void> => {
  const listOrders = _.fromPairs(
    unorderedLists.map(sortDef => [sortDef.elemID.getFullName(), sortDef.orderBy]),
  )
  // Cast all lists to list
  const castLists = async (field: Field, value: Value): Promise<Value> => {
    if (isListType(await field.getType()) && !_.isArray(value)) {
      return [value]
    }
    // We get from sfdc api list with empty strings for empty object (possibly jsforce issue)
    if (isListType(await field.getType()) && _.isArray(value)
      && _.isEmpty(value.filter(v => !_.isEmpty(v)))) {
      return []
    }

    const orderBy = listOrders[field.elemID.getFullName()]
    return orderBy ? _.orderBy(value, orderBy) : value
  }
  await applyRecursive(type, values, castLists)
}

const markHardcodedLists = async (
  type: ObjectType,
  knownListIds: Set<string>,
): Promise<void> => awu(_.values(type.fields))
  .filter(f => knownListIds.has(f.elemID.getFullName()))
  .forEach(async f => {
    const fieldType = await f.getType()
    // maps are created synthetically and should not be converted here
    if (!isContainerType(fieldType)) {
      f.refType = createRefToElmWithValue(new ListType(fieldType))
    }
  })

const sortAnnotations = (type: ObjectType,
  unorderedLists: ReadonlyArray<UnorderedList> = []): void => {
  unorderedLists.forEach(({ elemID: elemId, orderBy }) => {
    const parentId = elemId.createParentID()
    const parent = resolvePath(type, parentId)
    const parentValues = isElement(parent) ? parent.annotations : parent
    const annotationValue = _.get(parentValues, elemId.name)
    if (annotationValue === undefined) return
    const sortedAnnotation = _.orderBy(annotationValue, orderBy)
    _.set(parentValues, elemId.name, sortedAnnotation)
  })
}

export const convertList = async (type: ObjectType, values: Values): Promise<void> => {
  await markListRecursively(type, values)
  await castListRecursively(type, values)
}

const getMapFieldIds = async (
  types: ObjectType[],
): Promise<Set<string>> => {
  const objectsWithMapFields = await awu(types).filter(
    async obj => Object.keys(metadataTypeToFieldToMapDef).includes(await metadataType(obj))
  ).toArray()

  if (objectsWithMapFields.length > 0) {
    const allObjectsFields = objectsWithMapFields.flatMap(obj => Object.values(obj.fields))

    return new Set(await awu(allObjectsFields)
      .filter(async f => metadataTypeToFieldToMapDef[await metadataType(f.parent)] !== undefined)
      .filter(
        async f => metadataTypeToFieldToMapDef[await metadataType(f.parent)][f.name] !== undefined
      ).map(f => f.elemID.getFullName())
      .toArray())
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
): LocalFilterCreator => () => ({
  name: 'convertListsFilter',
  /**
   * Upon fetch, mark all list fields as list fields in all fetched types
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]) => {
    const instances = await awu(elements)
      .filter(isInstanceElement)
      .filter(async inst => isObjectType(await inst.getType()))
      .toArray()
    const objectTypes = elements.filter(isObjectType)

    const mapFieldIds = await getMapFieldIds(objectTypes)
    const knownListIds = new Set([
      ...hardcodedLists,
      ...unorderedListFields.map(sortDef => sortDef.elemID.getFullName()),
    ].filter(id => !mapFieldIds.has(id)))

    await awu(objectTypes).forEach(t => markHardcodedLists(t, knownListIds))
    await awu(instances).forEach(async inst => markListRecursively(
      await inst.getType(),
      inst.value
    ))
    await awu(instances).forEach(async inst => castListRecursively(
      await inst.getType(),
      inst.value, unorderedListFields
    ))
    objectTypes.forEach(t => sortAnnotations(t, unorderedListAnnotations))
  },
})

export default makeFilter(fieldsToSort, annotationsToSort, hardcodedListsData)
