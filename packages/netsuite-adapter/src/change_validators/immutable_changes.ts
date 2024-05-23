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
  AdditionChange,
  ChangeDataType,
  ChangeError,
  CORE_ANNOTATIONS,
  Field,
  InstanceElement,
  isAdditionOrModificationChange,
  isFieldChange,
  isInstanceChange,
  isModificationChange,
  isObjectTypeChange,
  isReferenceExpression,
  isServiceId,
  ModificationChange,
  ObjectType,
} from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { APPLICATION_ID, SCRIPT_ID } from '../constants'
import { isTypeWithMultiFieldsIdentifier, TYPE_TO_ID_FIELD_PATHS } from '../data_elements/types'
import {
  getElementValueOrAnnotations,
  isCustomFieldName,
  isCustomRecordType,
  isDataObjectType,
  isFileCabinetType,
} from '../types'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable

// In netsuite, a reference can be either a ReferenceExpression
// or a string of the form [/some/path] or [scriptid=someid] if no reference was found.
// In the case of ReferenceExpression, we would want to compare using the elemID,
// otherwise we can use the string.
const getReferenceIdentifier = (val: unknown): unknown => (isReferenceExpression(val) ? val.elemID.getFullName() : val)

const toModifiedAnnotationChangeError = (after: Field | ObjectType, modifiedAnno: string): ChangeError => ({
  elemID: after.elemID,
  severity: 'Error',
  message: `Can't deploy a modification to ${modifiedAnno}, as it's immutable`,
  detailedMessage: `This ${modifiedAnno} is immutable.\n In order to deploy this ${after.elemID.idType}, remove this change.`,
})

const typeServiceIdConditions = async <T extends AdditionChange<ObjectType> | ModificationChange<ObjectType>>(
  change: T,
  condition: (change: T, annoName: string) => boolean,
): Promise<string[]> => {
  const { after } = change.data
  if (!isCustomRecordType(after)) {
    return []
  }
  const serviceIdRefTypes = await awu(Object.entries(after.annotationRefTypes))
    .filter(async ([_annoName, refType]) => isServiceId(await refType.getResolvedValue()))
    .toArray()
  if (serviceIdRefTypes.length === 0 && condition(change, SCRIPT_ID)) {
    // In this case there are no serviceid refTypes and the scriptid changed.
    return [SCRIPT_ID]
  }
  return serviceIdRefTypes
    .filter(([annoName, _refType]) => condition(change, annoName))
    .map(([annoName, _refType]) => annoName)
}

const modificationServiceIdCondition = (change: ModificationChange<ChangeDataType>, annoName: string): boolean =>
  getElementValueOrAnnotations(change.data.before)[annoName] !==
  getElementValueOrAnnotations(change.data.after)[annoName]

const toModificationTypeErrors = async (change: ModificationChange<ObjectType>): Promise<ChangeError[]> => {
  const { after } = change.data
  const modifiedImmutableAnnotations = await typeServiceIdConditions(change, modificationServiceIdCondition)
  if (modificationServiceIdCondition(change, APPLICATION_ID)) {
    modifiedImmutableAnnotations.push(APPLICATION_ID)
  }
  return modifiedImmutableAnnotations.map(modifiedAnno => toModifiedAnnotationChangeError(after, modifiedAnno))
}

const fieldServiceIdConditions = <T extends AdditionChange<Field> | ModificationChange<Field>>(
  change: T,
  condition: (change: T, annoName: string) => boolean,
): string[] => {
  if (!(isCustomRecordType(change.data.after.parent) && isCustomFieldName(change.data.after.name))) {
    return []
  }
  return [SCRIPT_ID].filter(annoName => condition(change, annoName))
}

const toModificationFieldErrors = (change: ModificationChange<Field>): ChangeError[] => {
  const { after } = change.data
  return fieldServiceIdConditions(change, modificationServiceIdCondition).map(modifiedAnno =>
    toModifiedAnnotationChangeError(after, modifiedAnno),
  )
}

const instanceServiceIdConditions = async <
  T extends AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
>(
  change: T,
  condition: (change: T, annoName: string) => boolean,
): Promise<string[]> => {
  const { after } = change.data
  return awu(Object.values((await after.getType()).fields))
    .filter(field => field.annotations[CORE_ANNOTATIONS.HIDDEN_VALUE] !== true)
    .filter(async field => isServiceId(await field.getType()))
    .filter(field => condition(change, field.name))
    .map(field => field.elemID.getFullName())
    .toArray()
}

const toModificationInstanceErrors = async (change: ModificationChange<InstanceElement>): Promise<ChangeError[]> => {
  const { before, after } = change.data
  const modifiedImmutableFields = await instanceServiceIdConditions(change, modificationServiceIdCondition)

  const type = await after.getType()
  if (isDataObjectType(type) && isTypeWithMultiFieldsIdentifier(after.elemID.typeName)) {
    modifiedImmutableFields.push(
      ...TYPE_TO_ID_FIELD_PATHS[after.elemID.typeName]
        .filter(path => _.get(before.value, path) !== _.get(after.value, path))
        .map(path => after.elemID.createNestedID(...path).getFullName()),
    )
  }
  // the scriptid cannot be modified in custom record instances
  if (isCustomRecordType(type) && before.value[SCRIPT_ID] !== after.value[SCRIPT_ID]) {
    modifiedImmutableFields.push(SCRIPT_ID)
  }

  // parent annotations in file cabinet instances
  if (
    isFileCabinetType(after.refType) &&
    !_.isEqual(getParents(before).map(getReferenceIdentifier), getParents(after).map(getReferenceIdentifier))
  ) {
    modifiedImmutableFields.push(after.elemID.createNestedID(CORE_ANNOTATIONS.PARENT).getFullName())
  }

  if (modificationServiceIdCondition(change, APPLICATION_ID)) {
    modifiedImmutableFields.push(after.elemID.createNestedID(APPLICATION_ID).getFullName())
  }
  return modifiedImmutableFields.map(
    modifiedField =>
      ({
        elemID: after.elemID,
        severity: 'Error',
        message: "Can't deploy a modification to an immutable field",
        detailedMessage: `The ${modifiedField} field is immutable.\n In order to deploy this ${after.elemID.idType}, remove this field change.`,
      }) as ChangeError,
  )
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

const toAddedMissingAnnotationError = (after: Field | ObjectType, addedAnno: string): ChangeError => ({
  elemID: after.elemID,
  severity: 'Error',
  message: `Can't deploy a ${after.elemID.idType} without its ${addedAnno}`,
  detailedMessage: `Missing ${addedAnno}.\n In order to deploy this ${after.elemID.idType}, make sure it has a valid ${addedAnno}`,
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
  return fieldServiceIdConditions(change, additionServiceIdCondition).map(addedAnno =>
    toAddedMissingAnnotationError(after, addedAnno),
  )
}

const toAdditionInstanceErrors = async (change: AdditionChange<InstanceElement>): Promise<ChangeError[]> => {
  const { after } = change.data
  const missingServiceIdFields = await instanceServiceIdConditions(change, additionServiceIdCondition)

  return missingServiceIdFields.map(
    addedField =>
      ({
        elemID: after.elemID,
        severity: 'Error',
        message: `Can't deploy an instance without its ${addedField}`,
        detailedMessage: `Missing ${addedField}.\n In order to deploy this instance, make sure it has a valid ${addedField}`,
      }) as ChangeError,
  )
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

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .flatMap(async change => (isModificationChange(change) ? toModificationErrors(change) : toAdditionErrors(change)))
    .toArray()

export default changeValidator
