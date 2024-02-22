/*
 *                      Copyright 2024 Salto Labs Ltd.
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
  ChangeError,
  Field,
  getChangeData,
  ChangeValidator,
  isAdditionChange,
  Change,
  isFieldChange,
  isObjectTypeChange,
  ObjectType,
  isRemovalChange,
  isAdditionOrRemovalChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  isCustom,
  isCustomObject,
  isFieldOfCustomObject,
} from '../transformers/transformer'
import { safeApiName } from '../filters/utils'

const { awu } = collections.asynciterable

const isCustomFieldChange = async (change: Change<Field>): Promise<boolean> =>
  isFieldOfCustomObject(getChangeData(change))

const isCustomObjectChange = async (
  change: Change<ObjectType>,
): Promise<boolean> => isCustomObject(getChangeData(change))

const createFieldAdditionChangeError = async (
  field: Field,
): Promise<ChangeError> => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Standard field does not exist in target organization',
  detailedMessage: `The standard field ${field.name} of type ${await safeApiName(field.parent)} does not exist in your target organization. It is not possible to create a standard field through the API. You may need additional feature licenses. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed`,
})

const createObjectAdditionChangeError = async (
  objectType: ObjectType,
): Promise<ChangeError> => ({
  elemID: objectType.elemID,
  severity: 'Error',
  message: 'Standard object does not exist in target organization',
  detailedMessage: `The standard object ${await safeApiName(objectType)} does not exist in your target organization.  You cannot create a standard object through the API. You may need additional feature licenses. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed`,
})

const createFieldRemovalChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Cannot delete a standard field',
  detailedMessage: `Deletion of standard field ${field.name} through the API is forbidden. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed`,
})

const createObjectRemovalChangeError = async (
  objectType: ObjectType,
): Promise<ChangeError> => ({
  elemID: objectType.elemID,
  severity: 'Error',
  message: 'Cannot delete a standard object',
  detailedMessage: `Deletion of standard object ${await safeApiName(objectType)} through the API is forbidden. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8058127-creation-deletion-of-standard-field-object-is-not-allowed`,
})

/**
 * It is forbidden to add/remove standard fields or objects.
 */
const changeValidator: ChangeValidator = async (changes) => {
  const standardFieldChanges = await awu(changes)
    .filter(isFieldChange)
    .filter(isCustomFieldChange)
    .filter(
      async (field) =>
        !isCustom((await safeApiName(getChangeData(field))) ?? ''),
    )
    .toArray()

  const additionOrRemovalCustomObjectChanges = await awu(changes)
    .filter(isAdditionOrRemovalChange)
    .filter(isObjectTypeChange)
    .filter(isCustomObjectChange)
    .toArray()

  const addedOrDeletedCustomObjects = await awu(
    additionOrRemovalCustomObjectChanges,
  )
    .map(getChangeData)
    .toArray()

  const isFieldOfAddedOrDeletedCustomObject = (field: Field): boolean =>
    addedOrDeletedCustomObjects.some((customObject) =>
      Object.values(customObject.fields).includes(field),
    )

  const standardObjectChanges = await awu(additionOrRemovalCustomObjectChanges)
    .filter(
      async (obj) => !isCustom((await safeApiName(getChangeData(obj))) ?? ''),
    )
    .toArray()

  const standardFieldAdditionErrors = await awu(standardFieldChanges)
    .filter(isAdditionChange)
    .map(getChangeData)
    // We only want to create an error for fields that are not part of an added CustomObject type, since the error
    // will already be on their parent CustomObject change. This should also avoid blocking valid addition changes
    // in case the Field parent CustomObject was added.
    .filter((field) => !isFieldOfAddedOrDeletedCustomObject(field))
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
    // We only want to create an error for fields that are not part of a deleted CustomObject type, since the error
    // will already be on their parent CustomObject change. This should also avoid blocking valid deletion changes
    // in case the Field parent CustomObject was deleted.
    .filter((field) => !isFieldOfAddedOrDeletedCustomObject(field))
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
