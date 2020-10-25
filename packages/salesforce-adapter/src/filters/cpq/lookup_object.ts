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
import { Element, ObjectType, ReferenceExpression, Value, Change, ChangeDataType, isAdditionOrModificationChange, getChangeElement, isObjectTypeChange } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { apiName, isCustomObject } from '../../transformers/transformer'
import { FIELD_ANNOTATIONS, CPQ_PRODUCT_RULE, CPQ_PRICE_RULE, CPQ_LOOKUP_OBJECT_NAME, CONF_ATTR_NAME_TO_API_NAME, CPQ_CONFIGURATION_ATTRIBUTE, CPQ_DEFAULT_OBJECT_FIELD, CPQ_LOOKUP_QUERY, CPQ_TESTED_OBJECT, LOOKUP_QUERY_NAME_TO_API_NAME } from '../../constants'
import { getCustomObjects } from '../utils'

const OBJECTS_TO_LOOKUP_FIELDS = {
  [CPQ_PRODUCT_RULE]: {
    field: CPQ_LOOKUP_OBJECT_NAME,
  },
  [CPQ_PRICE_RULE]: {
    field: CPQ_LOOKUP_OBJECT_NAME,
  },
  [CPQ_CONFIGURATION_ATTRIBUTE]: {
    field: CPQ_DEFAULT_OBJECT_FIELD,
    valuesMapping: CONF_ATTR_NAME_TO_API_NAME,
  },
  [CPQ_LOOKUP_QUERY]: {
    field: CPQ_TESTED_OBJECT,
    valuesMapping: LOOKUP_QUERY_NAME_TO_API_NAME,
  },
} as Record<string, { field: string; valuesMapping?: Record<string, string> }>

const transformLookupObjectValueSetFullNames = (
  object: ObjectType,
  transformFullNameFn: (
    objectApiName: string,
    fullName: string
  ) => (ReferenceExpression | string | undefined)
): ObjectType => {
  const lookupObjectField = object.fields[OBJECTS_TO_LOOKUP_FIELDS[apiName(object)].field]
  if (lookupObjectField === undefined) {
    return object
  }
  const lookupValueSet = lookupObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET]
  if (lookupValueSet === undefined) {
    return object
  }
  lookupObjectField.annotations[FIELD_ANNOTATIONS.VALUE_SET] = lookupValueSet.map(
    (value: Value) => (
      {
        ...value,
        fullName: transformFullNameFn(apiName(object), value.fullName),
      }
    )
  )
  return object
}

const replaceLookupObjectValueSetValuesWithReferences = (customObjects: ObjectType[]): void => {
  const apiNameToElemID = Object.fromEntries(
    customObjects.map(object => [apiName(object), object.elemID])
  )
  const relevantObjects = customObjects
    .filter(object => Object.keys(OBJECTS_TO_LOOKUP_FIELDS).includes(apiName(object)))

  const transformFullNameToRef = (
    objectApiName: string,
    fullName: string
  ): ReferenceExpression | string | undefined => {
    const nameToApiMapping = OBJECTS_TO_LOOKUP_FIELDS[objectApiName].valuesMapping ?? {}
    const mappedFullName = nameToApiMapping[fullName] ?? fullName
    return (apiNameToElemID[mappedFullName] !== undefined
      ? new ReferenceExpression(apiNameToElemID[mappedFullName]) : fullName)
  }
  relevantObjects.forEach(
    object => (transformLookupObjectValueSetFullNames(object, transformFullNameToRef))
  )
}

const transformFullNameToApiName = (
  objectApiName: string,
  fullName: string,
): ReferenceExpression | string | undefined => {
  const nameToApiMapping = OBJECTS_TO_LOOKUP_FIELDS[objectApiName]?.valuesMapping ?? {}
  return nameToApiMapping[fullName] ?? fullName
}

const transformFullNameToLabel = (
  objectApiName: string,
  fullName: string,
): ReferenceExpression | string | undefined => {
  const nameToApiMapping = _.invert(OBJECTS_TO_LOOKUP_FIELDS[objectApiName]?.valuesMapping ?? {})
  return nameToApiMapping[fullName] ?? fullName
}

const transformLabelToApiName = (object: ObjectType): ObjectType =>
  (transformLookupObjectValueSetFullNames(object, transformFullNameToApiName))

const transformValuesBackToLabel = (object: ObjectType): ObjectType =>
  (transformLookupObjectValueSetFullNames(object, transformFullNameToLabel))

const getCustomObjectWithMappingLookupChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): ReadonlyArray<Change<ObjectType>> =>
  (changes
    .filter(isAdditionOrModificationChange)
    .filter(isObjectTypeChange)
    .filter(change =>
      (isCustomObject(getChangeElement(change)))
        && OBJECTS_TO_LOOKUP_FIELDS[apiName(getChangeElement(change))]?.valuesMapping))

const applyFuncOnCustomObjectWithMappingLookupChange = (
  changes: ReadonlyArray<Change<ChangeDataType>>,
  fn: (customScriptObject: ObjectType) => ObjectType
): void => {
  const customObjectWithMappingLookupChanges = getCustomObjectWithMappingLookupChanges(changes)
  customObjectWithMappingLookupChanges.forEach(change => (
    applyFunctionToChangeData(
      change,
      fn,
    )
  ))
}

const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    replaceLookupObjectValueSetValuesWithReferences(
      getCustomObjects(elements)
    )
  },
  preDeploy: async changes => {
    applyFuncOnCustomObjectWithMappingLookupChange(changes, transformValuesBackToLabel)
  },
  onDeploy: async changes => {
    applyFuncOnCustomObjectWithMappingLookupChange(changes, transformLabelToApiName)
    return []
  },
})

export default filter
