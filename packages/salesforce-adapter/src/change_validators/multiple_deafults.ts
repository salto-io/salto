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
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { apiName, metadataType } from '../transformers/transformer'
import { FieldReferenceDefinition, generateReferenceResolverFinder } from '../transformers/reference_mapping'


const fieldSelectMapping: FieldReferenceDefinition[] = [
  {
    src: { field: 'default', parentTypes: ['ProfileApplicationVisibility', 'ProfileRecordTypeVisibility', 'StandardValue'] },
  },
]

const createChangeError = (parentType: ObjectType, instance: InstanceElement): ChangeError =>
  ({
    elemID: instance.elemID,
    severity: 'Warning',
    message: `There cannot be more than one 'default' field set to 'true' in instance: ${apiName(instance)} of type: ${metadataType(instance)}.`,
    detailedMessage: `There is more than one 'default' field set to 'true' in instance: ${apiName(instance)} of type: ${metadataType(instance)}. Field type: ${metadataType(parentType)}.`,
  })

const isDefaultField = (field: Field): boolean => {
  const resolverFinder = generateReferenceResolverFinder(fieldSelectMapping)
  return resolverFinder(field).length > 0
}

const getMultipleDefaultsErrors = (after: InstanceElement): ChangeError[] => {
  const defaultValues: boolean[] = []
  const errors: ChangeError[] = []
  // TODO: name of transform func
  // TODO: design of transform func
  const transformFunc: TransformFunc = ({ value, field }) => {
    if (field !== undefined && isDefaultField(field) && value) {
      if (defaultValues.length === 0) {
        defaultValues.push(value)
      } else if (errors.length === 0) {
        errors.push(createChangeError(field.parent, after))
      }
    }
    return value
  }

  Object.entries(after.value)
    .filter(([fieldName]) => isContainerType(after.type.fields[fieldName]?.type))
    .forEach(([fieldName, fieldValues]) => {
      const fieldType = after.type.fields[fieldName].type as ContainerType
      transformValues({
        values: fieldValues,
        type: fieldType,
        transformFunc,
        strict: false,
      })
    })
  return errors
}

/**
   * It is forbidden to set more than 'default' field as 'true' for some types.
   */
const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeElement)
    .flatMap(getMultipleDefaultsErrors)
)

export default changeValidator
