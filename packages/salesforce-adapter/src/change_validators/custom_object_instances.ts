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
import {
  ChangeValidator, getChangeElement, isInstanceChange, isModificationDiff,
  InstanceElement, ChangeError, isAdditionDiff,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { FIELD_ANNOTATIONS } from '../constants'
import { isCustomObject } from '../transformers/transformer'

const getUpdateErrorsForNonUpdateableFields = async (
  before: InstanceElement,
  after: InstanceElement
): Promise<ReadonlyArray<ChangeError>> => (
  Object.values(after.type.fields)
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.UPDATEABLE])
    .map(field => {
      if (after.value[field.name] !== before.value[field.name]) {
        return {
          elemID: before.elemID,
          severity: 'Warning',
          message: `Unable to edit ${after.elemID.typeName}.${field.name} because it is a non-updateable field.`,
          detailedMessage: `Unable to edit ${field.name} inside ${before.elemID.getFullName()} because it is a non-updateable field.`,
        } as ChangeError
      }
      return undefined
    }).filter(values.isDefined)
)

const getCreateErrorsForNonCreatableFields = async (
  after: InstanceElement
): Promise<ReadonlyArray<ChangeError>> => (
  Object.values(after.type.fields)
    .filter(field => !field.annotations[FIELD_ANNOTATIONS.CREATABLE])
    .map(field => {
      if (!_.isUndefined(after.value[field.name])) {
        return {
          elemID: after.elemID,
          severity: 'Warning',
          message: `Unable to create ${after.elemID.typeName}.${field.name} because it is a non-creatable field.`,
          detailedMessage: `Unable to create ${field.name} inside ${after.elemID.getFullName()} because it is a non-creatable field.`,
        } as ChangeError
      }
      return undefined
    }).filter(values.isDefined)
)

const changeValidator: ChangeValidator = async changes => {
  const updateChangeErrors = _.flatten(await Promise.all(
    changes
      .filter(isInstanceChange)
      .filter(isModificationDiff)
      .filter(change => isCustomObject(getChangeElement(change)))
      .map(change =>
        getUpdateErrorsForNonUpdateableFields(change.data.before, change.data.after))
  ))

  const createChangeErrors = _.flatten(await Promise.all(
    changes
      .filter(isInstanceChange)
      .filter(isAdditionDiff)
      .filter(change => isCustomObject(getChangeElement(change)))
      .map(change =>
        getCreateErrorsForNonCreatableFields(getChangeElement(change)))
  ))

  return [
    ...updateChangeErrors,
    ...createChangeErrors,
  ]
}

export default changeValidator
