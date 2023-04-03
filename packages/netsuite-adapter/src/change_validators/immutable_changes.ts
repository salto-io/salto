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
import { AdditionChange, ChangeDataType, ChangeError, CORE_ANNOTATIONS, Field, InstanceElement, isAdditionOrModificationChange, isFieldChange, isInstanceChange, isModificationChange, isObjectTypeChange, isReferenceExpression, isServiceId, ModificationChange, ObjectType } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { APPLICATION_ID, SCRIPT_ID } from '../constants'
import { TYPE_TO_ID_FIELD_PATHS } from '../data_elements/types'
import { getElementValueOrAnnotations, isDataObjectType, isFileCabinetType } from '../types'
import { NetsuiteChangeValidator } from './types'


const { awu } = collections.asynciterable

// In netsuite, a reference can be either a ReferenceExpression
// or a string of the form [/some/path] or [scriptid=someid] if no reference was found.
// In the case of ReferenceExpression, we would want to compare using the elemID,
// otherwise we can use the string.
const getReferenceIdentifier = (val: unknown): unknown =>
  (isReferenceExpression(val) ? val.elemID.getFullName() : val)


const toModifiedAnnotationChangeError = (
  after: Field | ObjectType,
  modifiedAnno: string
): ChangeError => ({
  elemID: after.elemID,
  severity: 'Error',
  message: 'Can\'t deploy a modification to an immutable annotation',
  detailedMessage: `This ${modifiedAnno} annotation is immutable.\n`
    + 'In order to proceed with this deployment, please edit the element in Salto and remove this annotation change.',
})

const typeServiceIdConditions = <T extends AdditionChange<ObjectType> | ModificationChange<ObjectType>>(
  change: T,
  condition: (change: T, annoName: string) => boolean
): Promise<string[]> => {
  const { after } = change.data
  return awu(Object.entries(after.annotationRefTypes))
    .filter(async ([_annoName, refType]) => isServiceId(await refType.getResolvedValue()))
    .filter(([annoName, _refType]) => condition(change, annoName))
    .map(([annoName, _refType]) => annoName)
    .toArray()
}

const modificationServiceIdCondition = (change: ModificationChange<ChangeDataType>, annoName: string): boolean =>
  getElementValueOrAnnotations(change.data.before)[annoName]
  !== getElementValueOrAnnotations(change.data.after)[annoName]

const toModificationTypeErrors = async (change: ModificationChange<ObjectType>): Promise<ChangeError[]> => {
  const { before, after } = change.data
  const modifiedImmutableAnnotations = await typeServiceIdConditions(change, modificationServiceIdCondition)
  if (before.annotations[APPLICATION_ID] !== after.annotations[APPLICATION_ID]) {
    modifiedImmutableAnnotations.push(APPLICATION_ID)
  }
  return modifiedImmutableAnnotations.map(modifiedAnno => toModifiedAnnotationChangeError(after, modifiedAnno))
}

const fieldServiceIdConditions = <T extends AdditionChange<Field> | ModificationChange<Field>>(
  change: T,
  condition: (change: T, annoName: string) => boolean
): string[] => [SCRIPT_ID].filter(annoName => condition(change, annoName))

const toModificationFieldErrors = (change: ModificationChange<Field>): ChangeError[] => {
  const { after } = change.data
  return fieldServiceIdConditions(change, modificationServiceIdCondition)
    .map(modifiedAnno => toModifiedAnnotationChangeError(after, modifiedAnno))
}

const instanceServiceIdConditions = async <
  T extends AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
>(
  change: T,
  condition: (change: T, annoName: string) => boolean
): Promise<string[]> => {
  const { after } = change.data
  return awu(Object.values((await after.getType()).fields))
    .filter(async field => isServiceId(await field.getType()))
    .filter(field => condition(change, field.name))
    .map(field => field.elemID.getFullName())
    .toArray()
}

const toModificationInstanceErrors = async (
  change: ModificationChange<InstanceElement>
): Promise<ChangeError[]> => {
  const { before, after } = change.data
  const modifiedImmutableFields = await instanceServiceIdConditions(change, modificationServiceIdCondition)

  if (isDataObjectType(await after.getType())
    && after.elemID.typeName in TYPE_TO_ID_FIELD_PATHS) {
    modifiedImmutableFields.push(
      ...TYPE_TO_ID_FIELD_PATHS[after.elemID.typeName]
        .filter(path => _.get(before.value, path) !== _.get(after.value, path))
        .map(path => after.elemID.createNestedID(...path).getFullName())
    )
  }

  // parent annotations in file cabinet instances
  if (isFileCabinetType(after.refType)
    && !_.isEqual(
      getParents(before).map(getReferenceIdentifier),
      getParents(after).map(getReferenceIdentifier),
    )) {
    modifiedImmutableFields.push(
      after.elemID.createNestedID(CORE_ANNOTATIONS.PARENT).getFullName()
    )
  }

  if (before.value[APPLICATION_ID] !== after.value[APPLICATION_ID]) {
    modifiedImmutableFields.push(
      after.elemID.createNestedID(APPLICATION_ID).getFullName()
    )
  }
  return modifiedImmutableFields.map(modifiedField => ({
    elemID: after.elemID,
    severity: 'Error',
    message: 'Can\'t deploy a modification to an immutable field',
    detailedMessage: `The ${modifiedField} field is immutable.\n`
      + 'In order to proceed with this deployment, please edit the element in Salto and remove this field change.',
  } as ChangeError))
}

const toModificationErrors = async (change: ModificationChange<ChangeDataType>): Promise<ChangeError[]> => {
  if (isObjectTypeChange(change)) {
    return toModificationTypeErrors(change)
  }
  if (isFieldChange(change)) {
    return toModificationFieldErrors(change)
  }
  if (isInstanceChange(change)) {
    return toModificationInstanceErrors(change)
  }
  return []
}

const toAddedMissingAnnotationError = (
  after: Field | ObjectType,
  addedAnno: string
): ChangeError => ({
  elemID: after.elemID,
  severity: 'Error',
  message: 'Can\'t deploy an annotation without a ServiceID',
  detailedMessage: `This ${addedAnno} annotation is missing a ServiceID.\n`
    + 'In order to proceed with this deployment, please edit the element in Salto and add a valid ServiceID.',
})

const additionServiceIdCondition = (change: AdditionChange<ChangeDataType>, annoName: string): boolean =>
  getElementValueOrAnnotations(change.data.after)[annoName] === undefined

const toAdditionTypeErrors = async (change: AdditionChange<ObjectType>): Promise<ChangeError[]> => {
  const { after } = change.data
  const missingServiceIdAnnotations = await typeServiceIdConditions(change, additionServiceIdCondition)

  return missingServiceIdAnnotations.map(addedAnno => toAddedMissingAnnotationError(after, addedAnno))
}

const toAdditionFieldErrors = (change: AdditionChange<Field>): ChangeError[] => {
  const { after } = change.data
  return fieldServiceIdConditions(change, additionServiceIdCondition)
    .map(addedAnno => toAddedMissingAnnotationError(after, addedAnno))
}

const toAdditionInstanceErrors = async (
  change: AdditionChange<InstanceElement>
): Promise<ChangeError[]> => {
  const { after } = change.data
  const missingServiceIdAnnotations = await instanceServiceIdConditions(change, additionServiceIdCondition)

  return missingServiceIdAnnotations.map(addedAnno => ({
    elemID: after.elemID,
    severity: 'Error',
    message: 'Can\'t deploy a field without a ServiceID',
    detailedMessage: `The ${addedAnno} field is missing a ServiceID.\n`
      + 'In order to proceed with this deployment, please edit the element in Salto and add a valid ServiceID.',
  } as ChangeError))
}

const toAdditionErrors = async (change: AdditionChange<ChangeDataType>): Promise<ChangeError[]> => {
  if (isObjectTypeChange(change)) {
    return toAdditionTypeErrors(change)
  }
  if (isFieldChange(change)) {
    return toAdditionFieldErrors(change)
  }
  if (isInstanceChange(change)) {
    return toAdditionInstanceErrors(change)
  }
  return []
}

const changeValidator: NetsuiteChangeValidator = async changes => (
  awu(changes).filter(isAdditionOrModificationChange).flatMap(async change =>
    (isModificationChange(change) ? toModificationErrors(change) : toAdditionErrors(change))).toArray()
)

export default changeValidator
