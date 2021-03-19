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
import {
  ChangeError, getChangeElement, ChangeValidator, isAdditionOrModificationChange,
  isInstanceChange, Field, InstanceElement, isContainerType, ContainerType, ObjectType,
  isListType, isObjectType, Element, isFieldChange,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { apiName, isFieldOfCustomObject, metadataType } from '../transformers/transformer'
import { FieldReferenceDefinition, generateReferenceResolverFinder } from '../transformers/reference_mapping'


const fieldSelectMapping: FieldReferenceDefinition[] = [
  {
    src: { field: 'default', parentTypes: ['ProfileApplicationVisibility', 'ProfileRecordTypeVisibility', 'StandardValue', 'CustomValue'] },
  },
]

const createChangeError = (parentType: ObjectType, element: Element): ChangeError =>
  ({
    elemID: element.elemID,
    severity: 'Warning',
    message: `There cannot be more than one 'default' field set to 'true'. In element: ${apiName(element)} of type: ${metadataType(element)}. Parent field type: ${metadataType(parentType)}`,
    detailedMessage: `There is more than one 'default' field set to 'true'. In element: ${apiName(element)} of type: ${metadataType(element)}. Parent field type: ${metadataType(parentType)}.`,
  })

const isDefaultField = (field: Field): boolean => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return resolverFinder(field).length > 0
}

const getInstancesMultipleDefaultsErrors = (after: InstanceElement): ChangeError[] => {
// there could be more than one invalid valueset per instance
// - create exactly one error per parent field type
  const errorsByParentFieldType: Record<string, ChangeError> = {}

  Object.entries(after.value)
    .filter(([fieldName]) => isContainerType(after.type.fields[fieldName]?.type))
    .forEach(([fieldName, fieldValues]) => {
      const defaultValues: boolean[] = []

      const createErrorIfMultipleDefaults: TransformFunc = ({ value, field }) => {
        if (field !== undefined && isDefaultField(field) && value) {
          if (defaultValues.length === 0) {
            defaultValues.push(value)
          }
          errorsByParentFieldType[metadataType(field.parent)] = errorsByParentFieldType[
            metadataType(field.parent)]
            ?? createChangeError(field.parent, after)
        }
        return value
      }

      const fieldType = after.type.fields[fieldName].type as ContainerType
      if (isListType(fieldType) && isObjectType(fieldType.innerType) && _.isArray(fieldValues)) {
        const type = fieldType.innerType
        fieldValues.forEach(val => {
          transformValues({
            values: val,
            type,
            transformFunc: createErrorIfMultipleDefaults,
            strict: false,
            isTopLevel: false,
          })
        })
      } else {
        transformValues({
          values: fieldValues,
          type: fieldType,
          transformFunc: createErrorIfMultipleDefaults,
          strict: false,
          isTopLevel: false,
        })
      }
    })
  return Object.values(errorsByParentFieldType)
}

const getPicklistMultipleDefaultsErrors = (field: Field): ChangeError[] => {
  if (_.isArray(field.annotations.valueSet)) {
    return field.annotations.valueSet
      .map(value => value.default)
      .filter(Boolean).length > 1
      ? [createChangeError(field.parent, field)]
      : []
  }
  return []
}

/**
   * It is forbidden to set more than 'default' field as 'true' for some types.
   */
const changeValidator: ChangeValidator = async changes => {
  const instanceChangesErrors = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeElement)
    .flatMap(getInstancesMultipleDefaultsErrors)

  // special treatment for picklist & multipicklist valueSets
  const picklistChangesErrors = changes
    .filter(isAdditionOrModificationChange)
    .filter(isFieldChange)
    .map(getChangeElement)
    .filter(isFieldOfCustomObject)
    .filter(field => field.annotations.valueSet !== undefined)
    .flatMap(getPicklistMultipleDefaultsErrors)

  return [...instanceChangesErrors, ...picklistChangesErrors]
}

export default changeValidator
