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
import {
  ChangeError, Field, getChangeData,
  ChangeValidator, isAdditionChange, Change, isFieldChange,
  isObjectTypeChange,
  ObjectType,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { apiName, isCustom, isCustomObject, isFieldOfCustomObject } from '../transformers/transformer'

const { awu } = collections.asynciterable


const isCustomFieldChange = async (change: Change<Field>): Promise<boolean> =>
  (isFieldOfCustomObject(getChangeData(change)))

const isCustomObjectChange = async (change: Change<ObjectType>): Promise<boolean> =>
  (isCustomObject(getChangeData(change)))

const createFieldAdditionChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Standard field does not exist in target organization',
  detailedMessage: `The standard field ${field.name} of type ${field.parent} does not exist in your target organization. It is not possible to create a standard field through the API. You may need additional feature licenses.`,
})

const createObjectAdditionChangeError = async (objectType: ObjectType): Promise<ChangeError> => ({
  elemID: objectType.elemID,
  severity: 'Error',
  message: 'Standard object does not exist in target organization',
  detailedMessage: `The standard object ${await apiName(objectType)} does not exist in your target organization.  You cannot create a standard object through the API. You may need additional feature licenses.`,
})

const createFieldRemovalChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Cannot delete a standard field',
  detailedMessage: `Deletion of standard field ${field.name} through the API is forbidden.`,
})

const createObjectRemovalChangeError = async (objectType: ObjectType): Promise<ChangeError> => ({
  elemID: objectType.elemID,
  severity: 'Error',
  message: 'Cannot delete a standard object',
  detailedMessage: `Deletion of standard object ${await apiName(objectType)} through the API is forbidden.`,
})

/**
 * It is forbidden to create standard fields or objects.
 */
const changeValidator: ChangeValidator = async changes => {
  const standardFieldChanges = await awu(changes)
    .filter(isFieldChange)
    .filter(isCustomFieldChange)
    .filter(async field => !isCustom(await apiName(getChangeData(field))))
    .toArray()

  const standardObjectChanges = await awu(changes)
    .filter(isObjectTypeChange)
    .filter(isCustomObjectChange)
    .filter(async obj => !isCustom(await apiName(getChangeData(obj))))
    .toArray()

  const standardFieldAdditionErrors = await awu(standardFieldChanges)
    .filter(isAdditionChange)
    .map(getChangeData)
    .map(createFieldAdditionChangeError)
    .toArray()

  const standardObjectAdditionErrors = await awu(standardObjectChanges)
    .filter(isAdditionChange)
    .map(getChangeData)
    .map(createObjectAdditionChangeError)
    .toArray()

  const standardFieldRemovalErrors = await awu(standardFieldChanges)
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(createFieldRemovalChangeError)
    .toArray()

  const standardObjectRemovalErrors = await awu(standardObjectChanges)
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(createObjectRemovalChangeError)
    .toArray()

  return [
    ...standardFieldAdditionErrors,
    ...standardObjectAdditionErrors,
    ...standardFieldRemovalErrors,
    ...standardObjectRemovalErrors,
  ]
}

export default changeValidator
