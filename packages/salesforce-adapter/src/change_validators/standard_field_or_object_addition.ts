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
import { apiName, isCustom } from '../transformers/transformer'

const { awu } = collections.asynciterable


const isStandardFieldChange = (change: Change<Field>): boolean =>
  (!isCustom(getChangeData(change).elemID.getFullName()))

const isStandardObjectChange = (change: Change<ObjectType>): boolean =>
  (!isCustom(getChangeData(change).elemID.getFullName()))

const createFieldAdditionChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Cannot create a standard field',
  detailedMessage: `The standard field ${field.name} of type ${field.parent} does not exist in your organization. Please make sure you have the required enabled settings to manage this field.`,
})

const createObjectAdditionChangeError = (objectType: ObjectType): ChangeError => ({
  elemID: objectType.elemID,
  severity: 'Error',
  message: 'Cannot create a standard object',
  detailedMessage: `The standard object ${apiName(objectType)} does not exist in your org.  Please make sure you have the required enabled settings to manage this object.`,
})

const createFieldRemovalChangeError = (field: Field): ChangeError => ({
  elemID: field.elemID,
  severity: 'Error',
  message: 'Cannot delete a standard field',
  detailedMessage: `Deletion of standard field ${field.name} is forbidden.`,
})

const createObjectRemovalChangeError = (objectType: ObjectType): ChangeError => ({
  elemID: objectType.elemID,
  severity: 'Error',
  message: 'Cannot delete a standard object',
  detailedMessage: `Deletion of standard object ${apiName(objectType)} is forbidden.`,
})

/**
 * It is forbidden to create standard fields or objects.
 */
const changeValidator: ChangeValidator = async changes => {
  const standardFieldAdditions = await awu(changes)
    .filter(isAdditionChange)
    .filter(isFieldChange)
    .filter(isStandardFieldChange)
    .map(getChangeData)
    .map(createFieldAdditionChangeError)
    .toArray()

  const standardObjectAdditions = await awu(changes)
    .filter(isAdditionChange)
    .filter(isObjectTypeChange)
    .filter(isStandardObjectChange)
    .map(getChangeData)
    .map(createObjectAdditionChangeError)
    .toArray()

  const standardFieldRemovals = await awu(changes)
    .filter(isRemovalChange)
    .filter(isFieldChange)
    .filter(isStandardFieldChange)
    .map(getChangeData)
    .map(createFieldRemovalChangeError)
    .toArray()

  const standardObjectRemovals = await awu(changes)
    .filter(isRemovalChange)
    .filter(isObjectTypeChange)
    .filter(isStandardObjectChange)
    .map(getChangeData)
    .map(createObjectRemovalChangeError)
    .toArray()

  return [...standardFieldAdditions, ...standardObjectAdditions,
    ...standardFieldRemovals, ...standardObjectRemovals]
}

export default changeValidator
