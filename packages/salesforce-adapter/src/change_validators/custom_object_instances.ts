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
import _ from 'lodash'
import {
  ChangeValidator, getChangeElement, isModificationChange,
  InstanceElement, ChangeError, isAdditionChange,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-utils'
import { FIELD_ANNOTATIONS } from '../constants'
import { getLookUpName } from '../transformers/reference_mapping'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'

const getUpdateErrorsForNonUpdateableFields = (
  before: InstanceElement,
  after: InstanceElement
): ReadonlyArray<ChangeError> => {
  const beforeResolved = resolveValues(before, getLookUpName)
  const afterResolved = resolveValues(after, getLookUpName)
  return Object.values(afterResolved.getType().fields)
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.UPDATEABLE])
    .map(field => {
      if (afterResolved.value[field.name] !== beforeResolved.value[field.name]) {
        return {
          elemID: beforeResolved.elemID,
          severity: 'Warning',
          message: `Unable to edit ${afterResolved.elemID.typeName}.${field.name} because it is a non-updateable field.`,
          detailedMessage: `Unable to edit ${field.name} inside ${beforeResolved.elemID.getFullName()} because it is a non-updateable field.`,
        } as ChangeError
      }
      return undefined
    }).filter(values.isDefined)
}

const getCreateErrorsForNonCreatableFields = (
  after: InstanceElement
): ReadonlyArray<ChangeError> => {
  const afterResolved = resolveValues(after, getLookUpName)
  return Object.values(afterResolved.getType().fields)
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.CREATABLE])
    .map(field => {
      if (!_.isUndefined(afterResolved.value[field.name])) {
        return {
          elemID: afterResolved.elemID,
          severity: 'Warning',
          message: `Unable to create ${afterResolved.elemID.typeName}.${field.name} because it is a non-creatable field.`,
          detailedMessage: `Unable to create ${field.name} inside ${afterResolved.elemID.getFullName()} because it is a non-creatable field.`,
        } as ChangeError
      }
      return undefined
    }).filter(values.isDefined)
}


const changeValidator: ChangeValidator = async changes => {
  const updateChangeErrors = changes
    .filter(isInstanceOfCustomObjectChange)
    .filter(isModificationChange)
    .flatMap(change =>
      getUpdateErrorsForNonUpdateableFields(change.data.before, change.data.after))

  const createChangeErrors = changes
    .filter(isInstanceOfCustomObjectChange)
    .filter(isAdditionChange)
    .flatMap(change => getCreateErrorsForNonCreatableFields(getChangeElement(change)))

  return [
    ...updateChangeErrors,
    ...createChangeErrors,
  ]
}

export default changeValidator
