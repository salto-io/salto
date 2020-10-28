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
import { Element, ObjectType, ReferenceExpression, Value, Change, ChangeDataType, isAdditionOrModificationChange, getChangeElement, isObjectTypeChange, Field } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { apiName, isCustomObject, relativeApiName } from '../../transformers/transformer'
import { FIELD_ANNOTATIONS, CPQ_PRODUCT_RULE, CPQ_PRICE_RULE, CPQ_LOOKUP_OBJECT_NAME, DEFAULT_OBJECT_TO_API_MAPPING, CPQ_CONFIGURATION_ATTRIBUTE, CPQ_DEFAULT_OBJECT_FIELD, CPQ_LOOKUP_QUERY, CPQ_TESTED_OBJECT, TEST_OBJECT_TO_API_MAPPING, CUSTOM_OBJECT, CUSTOM_FIELD, CPQ_PRICE_SCHEDULE, SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING, CPQ_QUOTE, CPQ_CONSTRAINT_FIELD, CPQ_DISCOUNT_SCHEDULE, API_NAME_SEPARATOR } from '../../constants'
import { getCustomObjects } from '../utils'

type LookupFieldDef = {
  type: 'CustomObject'
  valuesMapping?: Record<string, string>
} | {
  type: 'CustomField'
  valuesMapping?: Record<string, string>
  objectContext: string
}

const LOOKUP_FIELDS = {
  [CPQ_PRODUCT_RULE]: {
    [CPQ_LOOKUP_OBJECT_NAME]: {
      type: CUSTOM_OBJECT,
    },
  },
  [CPQ_PRICE_RULE]: {
    [CPQ_LOOKUP_OBJECT_NAME]: {
      type: CUSTOM_OBJECT,
    },
  },
  [CPQ_CONFIGURATION_ATTRIBUTE]: {
    [CPQ_DEFAULT_OBJECT_FIELD]: {
      type: CUSTOM_OBJECT,
      valuesMapping: DEFAULT_OBJECT_TO_API_MAPPING,
    },
  },
  [CPQ_LOOKUP_QUERY]: {
    [CPQ_TESTED_OBJECT]: {
      type: CUSTOM_OBJECT,
      valuesMapping: TEST_OBJECT_TO_API_MAPPING,
    },
  },
  [CPQ_PRICE_SCHEDULE]: {
    [CPQ_CONSTRAINT_FIELD]: {
      type: CUSTOM_FIELD,
      objectContext: CPQ_QUOTE,
      valuesMapping: SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING,
    },
  },
  [CPQ_DISCOUNT_SCHEDULE]: {
    [CPQ_CONSTRAINT_FIELD]: {
      type: CUSTOM_FIELD,
      objectContext: CPQ_QUOTE,
      valuesMapping: SCHEDULE_CONTRAINT_FIELD_TO_API_MAPPING,
    },
  },
} as Record<string, Record<string, LookupFieldDef>>

const getObjectLookupFields = (object: ObjectType): Field[] =>
  (Object.values(_.pick(object.fields, Object.keys(LOOKUP_FIELDS[apiName(object)]))))

const transformLookupValueSetFullNames = (
  object: ObjectType,
  transformFullNameFn: (
    objectApiName: string,
    fieldName: string,
    fullName: string
  ) => (ReferenceExpression | string | undefined)
): ObjectType => {
  const lookupFields = getObjectLookupFields(object)
  lookupFields.forEach(field => {
    const lookupValueSet = field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
    if (lookupValueSet === undefined) {
      return
    }
    field.annotations[FIELD_ANNOTATIONS.VALUE_SET] = lookupValueSet.map(
      (value: Value) => (
        {
          ...value,
          fullName: transformFullNameFn(apiName(object), field.name, value.fullName),
        }
      )
    )
  })
  return object
}

const replaceLookupObjectValueSetValuesWithReferences = (customObjects: ObjectType[]): void => {
  const apiNameToCustomObject = Object.fromEntries(
    customObjects.map(object => [apiName(object), object])
  )
  const relevantObjects = customObjects
    .filter(object => Object.keys(LOOKUP_FIELDS).includes(apiName(object)))

  const transformFullNameToRef = (
    objectApiName: string,
    fieldName: string,
    fullName: string
  ): ReferenceExpression | string | undefined => {
    const lookupDef = LOOKUP_FIELDS[objectApiName]?.[fieldName]
    if (lookupDef === undefined) {
      return undefined
    }
    const nameToApiMapping = lookupDef.valuesMapping ?? {}
    const mappedFullName = nameToApiMapping[fullName] ?? fullName
    const elementToRef = lookupDef.type === CUSTOM_OBJECT
      ? apiNameToCustomObject[mappedFullName]
      : apiNameToCustomObject[lookupDef.objectContext ?? '']?.fields[mappedFullName]
    return (elementToRef !== undefined
      ? new ReferenceExpression(elementToRef.elemID) : fullName)
  }
  relevantObjects.forEach(
    object => (transformLookupValueSetFullNames(object, transformFullNameToRef))
  )
}

const transformFullNameToApiName = (
  objectApiName: string,
  fieldName: string,
  fullName: string,
): ReferenceExpression | string | undefined => {
  const lookupDef = LOOKUP_FIELDS[objectApiName]?.[fieldName]
  if (lookupDef === undefined) {
    return undefined
  }
  const nameToApiMapping = lookupDef.valuesMapping ?? {}
  const lookupApiName = nameToApiMapping[fullName] ?? fullName
  // Known issue: CUSTOM_FIELD fields that were not references will have full api name now
  // Will be solved when annotation will be handled in reference_mapping
  return lookupDef.type === CUSTOM_OBJECT
    ? lookupApiName
    : [lookupDef.objectContext, lookupApiName].join(API_NAME_SEPARATOR)
}

const transformFullNameToLabel = (
  objectApiName: string,
  fieldName: string,
  fullName: string,
): ReferenceExpression | string | undefined => {
  const lookupDef = LOOKUP_FIELDS[objectApiName]?.[fieldName]
  if (lookupDef === undefined) {
    return undefined
  }
  const nameToApiMapping = _.invert(lookupDef.valuesMapping ?? {})
  const lookupApiName = lookupDef.type === CUSTOM_OBJECT
    ? fullName
    : relativeApiName(fullName)
  return nameToApiMapping[lookupApiName] ?? lookupApiName
}

const transformLabelToApiName = (object: ObjectType): ObjectType =>
  (transformLookupValueSetFullNames(object, transformFullNameToApiName))

const transformValuesBackToLabel = (object: ObjectType): ObjectType =>
  (transformLookupValueSetFullNames(object, transformFullNameToLabel))

const doesObjectHaveValuesMappingLookup = (objectApiName: string): boolean =>
  (Object.values(LOOKUP_FIELDS[objectApiName] ?? {})
    .find(lookupDef => lookupDef.valuesMapping) !== undefined)

const getCustomObjectWithMappingLookupChanges = (
  changes: ReadonlyArray<Change<ChangeDataType>>
): ReadonlyArray<Change<ObjectType>> =>
  (changes
    .filter(isAdditionOrModificationChange)
    .filter(isObjectTypeChange)
    .filter(change =>
      (isCustomObject(getChangeElement(change)))
        && doesObjectHaveValuesMappingLookup(apiName(getChangeElement(change)))))

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
