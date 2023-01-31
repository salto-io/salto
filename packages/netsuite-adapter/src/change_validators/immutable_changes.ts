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
import { ChangeError, CORE_ANNOTATIONS, Field, InstanceElement, isFieldChange, isInstanceChange, isModificationChange, isObjectTypeChange, isReferenceExpression, isServiceId, ModificationChange, ObjectType } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { APPLICATION_ID, SCRIPT_ID } from '../constants'
import { TYPE_TO_ID_FIELD_PATHS } from '../data_elements/types'
import { isDataObjectType, isFileCabinetType } from '../types'
import { NetsuiteChangeValidator } from './types'


const { awu } = collections.asynciterable

// In netsuite, a reference can be either a ReferenceExpression
// or a string of the form [/some/path] or [scriptid=someid] if no reference was found.
// In the case of ReferenceExpression, we would want to compare using the elemID,
// otherwise we can use the string.
const getReferenceIdentifier = (val: unknown): unknown =>
  (isReferenceExpression(val) ? val.elemID.getFullName() : val)

const toTypeErrors = async (change: ModificationChange<ObjectType>): Promise<ChangeError[]> => {
  const { before, after } = change.data
  const modifiedImmutableAnnotations = await awu(Object.entries(after.annotationRefTypes))
    .filter(async ([_annoName, refType]) => isServiceId(await refType.getResolvedValue()))
    .filter(([annoName, _refType]) =>
      before.annotations[annoName] !== after.annotations[annoName])
    .map(([annoName, _refType]) => annoName)
    .toArray()
  if (before.annotations[APPLICATION_ID] !== after.annotations[APPLICATION_ID]) {
    modifiedImmutableAnnotations.push(APPLICATION_ID)
  }
  return modifiedImmutableAnnotations.map(modifiedAnno => ({
    elemID: after.elemID,
    severity: 'Error',
    message: 'Attempting to modify an immutable annotation',
    detailedMessage: `Annotation '${modifiedAnno}' is immutable`,
  } as ChangeError))
}

const toFieldErrors = (change: ModificationChange<Field>): ChangeError[] => {
  const { before, after } = change.data
  return [SCRIPT_ID]
    .filter(annoName => before.annotations[annoName] !== after.annotations[annoName])
    .map(modifiedAnno => ({
      elemID: after.elemID,
      severity: 'Error',
      message: 'Attempting to modify an immutable annotation',
      detailedMessage: `Annotation '${modifiedAnno}' is immutable`,
    } as ChangeError))
}

const toInstanceErrors = async (
  change: ModificationChange<InstanceElement>
): Promise<ChangeError[]> => {
  const { before, after } = change.data
  const modifiedImmutableFields = await awu(Object.values((await after.getType()).fields))
    .filter(async field => isServiceId(await field.getType()))
    .filter(field => before.value[field.name] !== after.value[field.name])
    .map(field => field.elemID.getFullName())
    .toArray()

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
    message: 'Attempting to modify an immutable field',
    detailedMessage: `Field (${modifiedField}) is immutable`,
  } as ChangeError))
}

const changeValidator: NetsuiteChangeValidator = async changes => (
  awu(changes).filter(isModificationChange).flatMap(async change => {
    if (isObjectTypeChange(change)) {
      return toTypeErrors(change)
    }
    if (isFieldChange(change)) {
      return toFieldErrors(change)
    }
    if (isInstanceChange(change)) {
      return toInstanceErrors(change)
    }
    return []
  }).toArray()
)

export default changeValidator
